/*!
 * vue-prerender v0.0.5
 * Copyright (c) 2017-present, Eldar Cejvanovic
 * License: MIT
 * Inspired by: https://blog.cloudboost.io/prerender-an-angular-application-with-angular-cli-and-puppeteer-25dede2f0252
 */
const colors = require('colors')
const puppeteer = require('puppeteer')
const express = require('express')
const { join, dirname } = require('path')
const pathToRegexp = require('path-to-regexp')
const { readFile, exists, writeFile } = require('mz/fs')
const del = require('del')
const { ncp } = require('ncp')
const mkdirp = require('mkdirp-promise')
const { uniq, difference, merge } = require('lodash')
const comboWizard = require('combo-wizard')
const { tidy } = require('htmltidy2')
const portfinder = require('portfinder')

// Default port.
const DEFAULT_PORT = 4848

// Browser and server so that it can be closed anywhere.
let browser
let server

// Log options.
const LOG = {
  level: 0,
  error: function (message) {
    if (this.level >= 1) {
      console.log(colors.red(`[vue-prerender] [error]   => ${message}`))
    }
  },
  warning: function (message) {
    if (this.level >= 2) {
      console.log(colors.yellow(`[vue-prerender] [warning] => ${message}`))
    }
  },
  info: function (message) {
    if (this.level >= 3) {
      console.log(colors.cyan(`[vue-prerender] [info]    => ${message}`))
    }
  }
}

// Main function.
async function main (port, targetPath, options) {
  // Assign `HOST` in scope.
  const HOST = `http://localhost:${port}`

  // Copy all files to a temp folder and set the source path.
  const sourcePath = join(targetPath, '.tmp_prerender')
  if (await exists(sourcePath)) {
    await del([sourcePath])
  }

  await (() => {
    return new Promise(function (resolve, reject) {
      ncp(targetPath, sourcePath, {
        filter: /^((?!\.tmp_prerender).)*$/ // Ignore .tmp_prerender directory.
      }, (err) => {
        if (err) {
          // LOG.error(err)
          reject(err)
        }
        resolve(true)
      })
    })
  })()

  // Starting an Express.js server to serve the static files.
  const app = express()

  // Getting the HTML content from the index.html file
  const index = (await readFile(join(sourcePath, 'index.html'))).toString()

  // Serving the static files.
  app.get('*.*', express.static(sourcePath))

  // Serving index.html, when puppeter requests the index page.
  app.get('*', (req, res) => res.send(index))

  // Starting the express server.
  server = await (new Promise((resolve, reject) => {
    const s = app.listen(port, e => e ? reject(e) : resolve(s))
  }))

  LOG.info(`Started server ${HOST}`)

  // Launching Puppeteer.
  browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']})

  LOG.info('Started browser.')

  // Creating a new Page.
  const page = await browser.newPage()

  // Remove leading slashes from the path.
  const removeLeadingSlash = (path) => {
    return path.replace(/^\/*/giu, '')
  }

  // Function for saving the rendered page.
  const savePage = async (path, pageHtml) => {
    // Verify if path is valid in vue-router.
    let pathValid = true
    if (options.verifyPaths) {
      const matched = await page.evaluate((path) => window._vuePrerender.$router.match(path).matched.length, path)

      if (matched === undefined) {
        pathValid = true // `vue-router` not found, accept all paths.
      } else if (matched === 0) {
        pathValid = false
      }
    }

    if (pathValid) {
      // Defining the HTML file name that will be added.
      const file = join(targetPath, path || '', 'index.html')
      const dir = dirname(file)

      // Beautify code if `tidy` is set to true in options.
      if (options.tidy) {
        pageHtml = await (() => {
          return new Promise(function (resolve, reject) {
            tidy(pageHtml, options.tidyOptions, function (err, html) {
              if (err) {
                LOG.error(err.message)
                reject(err)
              } else {
                resolve(html)
              }
            })
          })
        })()
      }

      // Check if directory exists, if not create the directory.
      if (!(await exists(dir))) {
        await mkdirp(dir)
      }

      // Write the rendered HTML file.
      await writeFile(file, pageHtml)

      LOG.info(`Saved: ${file}`)
    } else {
      LOG.warning(`Skipped (invalid path):  ${path}`)
    }
  }

  // Function for removing ignored paths.
  const removeIgnoredPaths = (paths) => {
    paths = paths.filter((path) => {
      let pathIgnored = false
      for (let _exception of options.pathExceptions) {
        if (_exception instanceof RegExp) {
          const result = _exception.test(path)

          if (result) {
            LOG.info(`Ignored path (by RegExp): ${path}`)
            pathIgnored = true
            break
          }
        } else {
          if (path.indexOf(_exception) === 0) {
            LOG.info(`Ignored path (by string): ${path}`)
            pathIgnored = true
            break
          }
        }
      }

      return !pathIgnored
    })

    return paths
  }

  const removeIgnoredURLs = (paths) => {
    // Remove ignored paths.
    paths = paths.filter((path) => {
      let pathIgnored = false
      for (let _exception of options.urlExceptions) {
        if (_exception instanceof RegExp) {
          const result = _exception.test(path)

          if (result) {
            LOG.info(`Ignored URL (by RegExp): ${path}`)
            pathIgnored = true
            break
          }
        } else {
          if (path.indexOf(_exception) === 0) {
            LOG.info(`Ignored URL (by string): ${path}`)
            pathIgnored = true
            break
          }
        }
      }

      return !pathIgnored
    })

    return paths
  }

  // Functionality of three main options.
  if (options.catchPaths) { // Pre-render pages by catching all links from pages recursively.
    let _pages = ['']
    let _renderedPages = []

    do {
      const path = _pages[0]

      // Requesting the first page in `_pages` array.
      await page.goto(`${HOST}/${removeLeadingSlash(path)}`)

      // Get the HTML content after Chromium finishes rendering.
      const result = await page.evaluate(() => document.documentElement.outerHTML)
      await savePage(path, result)

      // Add current page to the `_renderedPages` array.
      _renderedPages = [..._renderedPages, path]

      // Set `_pages` with the pages that still need to be rendered.
      _pages = difference(
        uniq(_pages.concat(result.match(/href="\/[/\w\d-]*"/g).map(s => s.match(/\/([/\w\d-]*)/)[1]))),
        _renderedPages
      )
      _pages = removeIgnoredPaths(_pages)
    } while (_pages.length > 0)
  } if (options.paths && options.paths.length > 1) { // Pre-render a list of pre-defined paths.
    let _pages = options.paths
    _pages = removeIgnoredPaths(_pages)
    let _renderedPages = []

    for (let _page of _pages) {
      if (!_renderedPages.includes(_page)) {
        const path = _page
        await page.goto(`${HOST}/${removeLeadingSlash(path)}`)

        // Get the HTML content after Chromium finishes rendering.
        const result = await page.evaluate(() => document.documentElement.outerHTML)
        await savePage(path, result)

        _renderedPages.push(path)
      }
    }
  } else if (options.parseRouter) { // Pre-render pages by parsing the `vue-router` options.
    // Requesting the index page.
    await page.goto(`${HOST}/`)

    // Get router paths directly from `vue-router`.
    let paths = await page.evaluate(() => {
      const _paths = []
      if (!window._vuePrerender) {
        return 'GLOBAL_VAR_UNDEFINED'
      } else if (!window._vuePrerender.$router) {
        return 'ROUTER_UNDEFINED'
      } else if (window._vuePrerender.$router.mode !== 'history') {
        return 'ROUTER_NOT_HISTORY_MODE'
      } else {
        if (window._vuePrerender.$i18nRoutes) {
          window._vuePrerender.$i18nRoutes.forEach((_route) => {
            _paths.push(_route.path)
          })
        } else {
          window._vuePrerender.$router.options.routes.forEach((_route) => {
            _paths.push(_route.path)
          })
        }

        return _paths
      }
    })

    let pathsSet = true
    if (paths === 'GLOBAL_VAR_UNDEFINED') {
      LOG.error('Global `window._vuePrerender` variable not defined (please refer to the documentation).')
      pathsSet = false
    } else if (paths === 'ROUTER_UNDEFINED') {
      LOG.error('`vue-router` not defined.')
      pathsSet = false
    } else if (paths === 'ROUTER_NOT_HISTORY_MODE') {
      LOG.error('`vue-router` not in `history` mode (please refer to the documentation).')
      pathsSet = false
    }

    if (pathsSet) {
      paths = removeIgnoredPaths(paths)

      const mockAllParams = (path, keys) => {
        // Generate paths based on generated parameter combination and render valid paths.
        const toPath = pathToRegexp.compile(path)

        let _paths = []
        const allValidCombinations = comboWizard(options.routerParams, keys)
        allValidCombinations.forEach((params) => {
          try {
            _paths.push(toPath(params))
          } catch (err) {
            LOG.error(`${path} -> ${err.message}`)
          }
        })
        _paths = removeIgnoredURLs(_paths)

        return _paths
      }

      // Save HTML files for all possible paths.
      for (let _path of paths) {
        let keys = []
        pathToRegexp(_path, keys)

        keys.forEach((_key) => {
          keys.push(_key.name)
        })

        let allPaths = [_path]
        if (keys.length > 0) {
          allPaths = mockAllParams(_path, keys)
        }

        for (let _path of allPaths) {
          // Load the current path.
          await page.goto(`${HOST}/${removeLeadingSlash(_path)}`)

          // Get the HTML content after Chromium finishes rendering.
          // const result = await page.evaluate(() => document.documentElement.outerHTML)
          const result = await page.content()

          await savePage(_path, result)
        }
      }
    }
  } else {
    LOG.error('Pre-rendering couldn\'t be started because these three configuration options are all set to false: `parseRouter`, `paths`, `catchPaths`. Please refer to the documentation.')
  }

  // Close Chromium and the express server.
  browser.close()
  server.close()

  // Delete `.tmp` directory.
  await del([sourcePath])
}

const _defaultOptions = {
  logLevel: 3, // 0 - no log output; 1 (default) - just errors; 2 - errors and warnings; 3 - all output
  parseRouter: true, // Default option. Pre-render will parse the options from `vue-router and pre-render all routes.
  pathExceptions: [], // List of regex patterns or just plain strings which indicate which routes need to be skipped. Patterns are matched against vue-router paths (without injected params).
  urlExceptions: [], // List of regex patterns or just plain strings which indicate which URLs need to be skipped. Patterns are matched against vue-router compiled paths (with injected params).
  routerParams: {}, // For every params there can be a list of values. Those values will be injected and for each a pre-rendered file will be made.
  // Example for locale: paramsRules: {'_locale': ['de', 'bs']} will generate following URLs for path `/:_locale`: `localhost:port/de`, `localhost:port/bs`, and those pages will be saved as pre-rendered.
  paths: [], // All the paths which need to be rendered (if this is set parsing the `vue-router` options will be skipped).
  catchPaths: false, // Catch all URLs from pages, and catch them recursively. If set, `paths` and `parseRouter` will be ignored.
  verifyPaths: true, // Before saving HTML for a path, check if that path is valid inside of the `vue-router` configuration.
  tidy: false,
  tidyOptions: {
    doctype: 'html5',
    hideComments: false,
    indent: true,
    wrap: false,
    'wrap-sections': false
  } // Beautify HTML.
}

const _parseOptions = function (options) {
  if (options.logLevel !== 0 && options.logLevel !== 1 && options.logLevel !== 2 && options.logLevel !== 3) {
    options.logLevel = 0
  }

  options.parseRouter = !!options.parseRouter

  if (!(options.pathExceptions instanceof Array)) {
    if (typeof options.pathExceptions === 'string') {
      options.pathExceptions = [options.pathExceptions]
    } else {
      options.pathExceptions = []
    }
  }

  if (!(options.urlExceptions instanceof Array)) {
    if (typeof options.urlExceptions === 'string') {
      options.urlExceptions = [options.urlExceptions]
    } else {
      options.urlExceptions = []
    }
  }

  if (!(typeof options.routerParams === 'object')) {
    options.routerParams = {}
  }

  // Reconfigure the router parameters so that it has following format:
  // {
  //   parameterKey: {
  //     _default: { // Will be converted to _default._default array even there is just an array or string.
  //       _default: [value1, value2, ..., valueN] // Required.
  //     },
  //     otherParameterKey: {
  //       _default: [thisParameterValue3, thisParameterValue4, ..., valueN], // For other parameters inside aparameterr rule object this is optional. This will be used if the otherParameter is in combination with the parameter, but no other rules are defined.
  //       otherParameterValue: [thisParameterValue1, thisParameterValue2, thisParameterValueN] // Parameters to be set when otherParameterValue has certain value.
  //     }
  //   },
  //   otherParameterKey: {
  //     _default: {
  //       _default: [value1, value2, ..., valueN] // Required.
  //     }
  //   }
  // }
  // All strings and numbers at any level will be converted to an array with just that value in the array.
  // Objects are parsed until the last level, where a blank array will be set if there is no string, number or array.
  // Proper arrays will be set as the data set.
  const _checkArray = (_arr) => {
    for (const i in _arr) {
      if (_arr[i] === '') {
        _arr[i] = undefined
      }
    }

    return _arr
  }

  if (!(options.paths instanceof Array)) {
    if (typeof options.paths === 'string') {
      options.paths = [options.paths]
    } else {
      options.paths = []
    }
  }

  options.catchPaths = !!options.catchPaths
  options.verifyPaths = !!options.verifyPaths
  options.tidy = !!options.tidy

  if (!(typeof options.tidyOptions === 'object')) {
    options.tidyOptions = {}
  }

  return options
}

const _vuePrerender = function (targetPath, _options, cb) {
  targetPath = join(process.cwd(), targetPath)

  let options = {}
  merge(options, _defaultOptions)
  merge(options, _options)
  options = _parseOptions(options)
  LOG.level = options.logLevel

  // Run the main function.
  portfinder.basePort = DEFAULT_PORT
  portfinder.getPortPromise()
    .then((port) => {
      main(port, targetPath, options)
        .then(() => {
          LOG.info('Prerendering finished.')

          // Callback
          if (typeof cb === 'function') {
            cb()
          }
        })
        .catch(err => {
          LOG.error(err)

          // Close Chromium and the express server.
          if (browser && browser.close) {
            browser.close()
          }

          if (server && server.close) {
            server.close()
          }

          // Callback
          if (typeof cb === 'function') {
            cb()
          }
        })
    })
    .catch((err) => {
      LOG.error(err)

      // Close Chromium and the express server.
      if (browser && browser.close) {
        browser.close()
      }

      if (server && server.close) {
        server.close()
      }

      // Callback
      if (typeof cb === 'function') {
        cb()
      }
    })
}

module.exports = _vuePrerender

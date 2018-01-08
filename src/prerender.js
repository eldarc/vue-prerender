/*!
 * vue-prerender v0.0.4
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
const { uniq, difference, merge, cloneDeep } = require('lodash')
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
        window._vuePrerender.$router.options.routes.forEach((_route) => {
          _paths.push(_route.path)
        })

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
        // Flatten parameter value rules to a single array for each parameter.
        const _flattenObject = (key) => {
          if (options.routerParams[key]) {
            let _flattened = []

            const _flatten = (_obj, _key) => {
              for (const prop of Object.keys(_obj[_key])) {
                if (_obj[_key][prop] instanceof Array) {
                  _flattened.push(..._obj[_key][prop])
                } else {
                  _flatten(_obj[_key], prop)
                }
              }
            }
            _flatten(options.routerParams, key)

            return _flattened
          }

          return []
        }

        // Generate a collection of flattened arrays.
        const _valueArrays = (() => {
          const _arr = []
          for (const key of keys) {
            _arr.push({
              key: key,
              values: uniq(_flattenObject(key))
            })
          }

          return _arr
        })()

        // Check if the current combination of parameters is valid.
        const _isCombinationValid = (parameters) => {
          let isValid = true
          const parameterKeys = Object.keys(parameters)

          // If there is only one parameter, check if its value is in the default array, and return immediately as valid or invalid.
          // In these cases checking the dependencies is unnecessary.
          if (parameterKeys.length === 1) {
            const parameterValue = parameters[parameterKeys[0]]
            const parameterRules = options.routerParams[parameterKeys[0]]

            if (!(parameterRules._default._default.includes(parameterValue))) {
              isValid = false
            }

            return isValid
          }

          // For each parameter, loop trough all the other parameters and check dependencies between them.
          for (const parameterKey of parameterKeys) {
            // If the parameter is already invalid break the loop.
            if (isValid === false) {
              break
            }

            const parameterValue = parameters[parameterKey]

            // Parameter rules contain possible values of the current parameter, and dependencies on other parameters.
            const parameterRules = options.routerParams[parameterKey]

            // If there isn't a rule definition for the parameter, continue.
            if (!parameterRules) {
              continue
            }

            // Iterate through all the other parameters in the combination.
            for (const otherParameterKey of parameterKeys) {
              // Skip when on the current `parameterKey`.
              if (otherParameterKey === parameterKey) {
                continue
              }

              const otherParameterValue = parameters[otherParameterKey]

              // If there is a specific definition of what parameters are allowed in a combination,
              // based on that array assume allowed values for the current parameter.
              let allowedValues = []
              if (parameterRules[otherParameterKey] && parameterRules[otherParameterKey][otherParameterValue]) {
                allowedValues = parameterRules[otherParameterKey][otherParameterValue]
              } else if (parameterRules[otherParameterKey] && parameterRules[otherParameterKey]._default) {
                allowedValues = parameterRules[otherParameterKey]._default
              }

              // If the `allowedValues` array has items and the current parameter isn't included, flag the combination as invalid.
              if (allowedValues.length > 0 && !allowedValues.includes(parameterValue)) {
                isValid = false
                break
              } else {
                // If there aren't specific definition of what values are allowed, try to assume by checking the other parameter value.
                if (parameterRules[otherParameterKey]) {
                  let allowedOtherValues = []
                  // For each other parameter rule for the current parameter rules get the key,
                  // and if that rule contains the current parameter value add the key as a other parameter allowed value.
                  for (const _otherParameterValue of Object.keys(parameterRules[otherParameterKey])) {
                    if (parameterRules[otherParameterKey][_otherParameterValue].includes(parameterValue)) {
                      allowedOtherValues.push(_otherParameterValue)
                    }
                  }

                  // If the list of other parameter allowed values has items and doesn't include the current other parameter value flag it as invalid.
                  if (allowedOtherValues.length > 0 && !allowedOtherValues.includes(otherParameterValue)) {
                    isValid = false
                    break
                  }
                }
              }
            }
          }

          return isValid
        }

        // Valid combinations are stored into the `allValidCombinations` array.
        const allValidCombinations = []

        // Generates a combination and places it into `__OBJECT_BUFFER`.
        // With every iteration `__OBJECT_BUFFER` is reset.
        // Generate all possible combinations, and for each check validity with `_isCombinationValid`.
        // Push all valid combinations to the `allValidCombinations`.
        let __OBJECT_BUFFER = {}
        ;(function _generateCombinations (index = 0) {
          if (index < _valueArrays.length) {
            const param = _valueArrays[index]

            if (param.values.length === 0) {
              param.values = ['']
            }

            for (const value of param.values) {
              if (index === 0) {
                __OBJECT_BUFFER = {}
              }

              __OBJECT_BUFFER[param.key] = value

              if (index === _valueArrays.length - 1) {
                const _object = cloneDeep(__OBJECT_BUFFER)

                if (_isCombinationValid(_object)) {
                  allValidCombinations.push(_object)
                }
              } else {
                _generateCombinations(index + 1)
              }
            }
          }
        })()

        // Generate paths based on generated parameter combination and render valid paths.
        const toPath = pathToRegexp.compile(path)

        let _paths = []
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

        keys = keys.map((_key) => {
          return _key.name
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
  for (const routerParam of Object.keys(options.routerParams)) {
    if (options.routerParams[routerParam] instanceof Array) {
      options.routerParams[routerParam] = {
        _default: _checkArray(options.routerParams[routerParam])
      }
    } else if (typeof options.routerParams[routerParam] === 'string' || typeof options.routerParams[routerParam] === 'number') {
      options.routerParams[routerParam] = {
        _default: _checkArray([options.routerParams[routerParam]])
      }
    } else if (typeof options.routerParams[routerParam] === 'object') {
      for (const otherRouterParam of Object.keys(options.routerParams[routerParam])) {
        if (typeof options.routerParams[routerParam][otherRouterParam] === 'string' || typeof options.routerParams[routerParam][otherRouterParam] === 'number') {
          options.routerParams[routerParam][otherRouterParam] = {
            _default: _checkArray([options.routerParams[routerParam][otherRouterParam]])
          }
        } else if (options.routerParams[routerParam][otherRouterParam] instanceof Array) {
          const _arr = options.routerParams[routerParam][otherRouterParam]
          options.routerParams[routerParam][otherRouterParam] = {
            _default: _checkArray(_arr)
          }
        } else if (typeof options.routerParams[routerParam][otherRouterParam] === 'object') {
          for (const paramValue of Object.keys(options.routerParams[routerParam][otherRouterParam])) {
            if (typeof options.routerParams[routerParam][otherRouterParam][paramValue] === 'string' || typeof options.routerParams[routerParam][otherRouterParam][paramValue] === 'number') {
              options.routerParams[routerParam][otherRouterParam][paramValue] = _checkArray([options.routerParams[routerParam][otherRouterParam][paramValue]])
            } else if (!(options.routerParams[routerParam][otherRouterParam][paramValue] instanceof Array)) {
              options.routerParams[routerParam][otherRouterParam][paramValue] = []
            }
          }
        } else {
          options.routerParams[routerParam][otherRouterParam] = {
            _default: []
          }
        }
      }
    } else {
      options.routerParams[routerParam] = {
        _default: []
      }
    }

    if (!options.routerParams[routerParam]._default) {
      options.routerParams[routerParam]._default = []
    }
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

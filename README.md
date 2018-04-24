# vue-prerender [![NPM version](https://badge.fury.io/js/vue-prerender.svg)](https://npmjs.org/package/vue-prerender)

> vue-prerender implements three strategies for prerendering Vue.js pages using headless chrome.

## Installation

```sh
$ npm install --save-dev vue-prerender
```

or

```sh
$ yarn add --dev vue-prerender
```

## Usage
There are two main ways of integrating `vue-prerender` into your projects:
1. Creating a new script called `prerender` and defining its use inside `package.json`.
2. Integrating directly to the `build` script.

In both cases prerendering needs to start after your build was successful.

### Prerender script
Create a new file called `prerender.js` inside your `build` directory or wherever you wish, with the following contents:

```js
var vuePrerender = require('vue-prerender');
var options = {
  logLevel: 3,
  parseRouter: true,
  tidy: true
};

vuePrerender('dist', options);
```

Inside your `package.json` file define the following script:
```js
"scripts": {
    "prerender": "node build/prerender.js"
}
```

or add it to the `build` script:
```js
"scripts": {
    "build": "node build/build.js && node build/prerender.js"
}
```

Now you can call the script manually with `npm run prerender` after `npm run build` finishes, or if you have added it to the build script it will run automatically after the build finishes.

### Integrate to the build script
If you used the `vue-cli` tool to generate the project from a `webpack` template, you are going to have a `build` directory which will contain the `build.js` file. Inside that file, you need to place the `vue-prerender` execution in the callback that is called when webpack finishes. The previous callback content is moved to the callback that will be called by `vue-prerender`.

```js
const spinner = ora('building for production...')
spinner.start()

rm(path.join(config.build.assetsRoot, config.build.assetsSubDirectory), err => {
  if (err) throw err
  webpack(webpackConfig, (err, stats) => {
    console.log('\nStarting prerendering...')
    vuePrerender('dist', {
      logLevel: 3,
      parseRouter: true,
      tidy: true
    }, () => {
      spinner.stop()
      if (err) throw err
      process.stdout.write(stats.toString({
        colors: true,
        modules: false,
        children: false, // If you are using ts-loader, setting this to true will make TypeScript errors show up during build.
        chunks: false,
        chunkModules: false
      }) + '\n\n')

      if (stats.hasErrors()) {
        console.log(chalk.red('  Build failed with errors.\n'))
        process.exit(1)
      }

      console.log(chalk.cyan('  Build complete.\n'))
      console.log(chalk.yellow(
        '  Tip: built files are meant to be served over an HTTP server.\n' +
        '  Opening index.html over file:// won\'t work.\n'
      ))
    })
  })
})
```

## Modes
### Parse router
`vue-prerender` will generate files for routes defined in your router. This is the **default** mode.
For this to work you need to modify your main vue instance in `main.js` so that is exposed as a global constant:
```js
const _vue = new Vue({
  el: '#app',
  router,
  components: { App },
  template: '<App/>'
})

window._vuePrerender = _vue
```

This is activated with the option `parseRouter: true`

### List of paths
Parse all paths that are listed in an array.
This is activated with the option `paths: []`.
If this is set then router parsing will be skipped.

### Catch paths automatically
Catch automatically all paths detected on all pages, starting with the root path.
This is activated with the option `catchPaths: []`.
If this is set then both router parsing and custom defined path prerendering will be skipped.

## Available options
### Defaults
```js
logLevel: 3,
parseRouter: true,
pathExceptions: [],
urlExceptions: [],
routerParams: {},
paths: [],
catchPaths: false,
verifyPaths: true,.
tidy: false,
tidyOptions: {
    doctype: 'html5',
    hideComments: false,
    indent: true,
    wrap: false,
    'wrap-sections': false
}
```

#### `logLevel`

| Value | Level of logging |
|---|---|
| 0 | **No log output.** |
| 1 | **Log just errors.** |
| 2 | **Log errors and warnings.** |
| 3 | **DEFAULT: Log errors, warnings, and info messages.**|

#### `parseRouter`

**Default: `true`**
> Parse routes from `vue-router` and prerender all routes.

#### `pathExceptions`

**Default: `[]`**
> List of regex patterns or just plain strings which indicate which routes need to be skipped. Patterns are matched against vue-router paths (without injected params).

#### `urlExceptions`

**Default: `[]`**
> List of regex patterns or just plain strings which indicate which URLs need to be skipped. Patterns are matched against vue-router compiled paths (with injected params).

#### `routerParams`

**Default: `{}`**
> Define values for parameters inside dynamic routes.

If there is a route like such:
```js
{
    path: '/:language/about-us',
    component: AboutUs
}
```

and following languages are available: `['en', 'de', 'bs']`, then the option `routerParams` would look like this:
```js
routerParams: {
    language: [null, 'en', 'de', 'bs']
}
```

Paths that will be prerendered:
```
/about-us
/en/about-us
/de/about-us
/bs/about-us
```

Also, more complex relationships betwen parameters could be defined. `vue-prerender` uses the helper library `combo-wizard` for parsing the `routerParams` options object. For detailed explanations and examples please read the **`combo-wizard` [README](https://github.com/ministryofprogramming/combo-wizard): [https://github.com/ministryofprogramming/combo-wizard](https://github.com/ministryofprogramming/combo-wizard)**

#### `paths`

**Default: `[]`**
> Parse all paths that are listed in the array. If this is set then router parsing will be skipped.

#### `catchPaths`

**Default: `false`**
> Catch automatically all paths detected on all pages, starting with the root path. If this is set then both router parsing and custom defined path prerendering will be skipped.

#### `verifyPaths`

**Default: `true`**
> Before saving an HTML file for a path, check if that path is valid inside of the `vue-router` configuration.

#### `tidy`

**Default: `false`**
> Beautify the HTML output using the `htmltidy2` module.

#### `tidyOptions`
> HTML Tidy options.

**Default:**
```js
tidyOptions: {
    doctype: 'html5',
    hideComments: false,
    indent: true,
    wrap: false,
    'wrap-sections': false
  }
```
All available options availabe in the [HTML Tidy API and Quick Reference](http://api.html-tidy.org/)

## License

MIT © [Eldar Cejvanovic](https://github.com/eldarc)

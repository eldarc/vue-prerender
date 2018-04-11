'use strict';

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var main = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(port, targetPath, options) {
    var _this = this;

    var HOST, sourcePath, app, index, page, removeLeadingSlash, savePage, removeIgnoredPaths, removeIgnoredURLs, _pages, _renderedPages, path, result, _pages2, _renderedPages2, _iteratorNormalCompletion3, _didIteratorError3, _iteratorError3, _iterator3, _step3, _page, _path2, _result, paths, pathsSet, mockAllParams, _loop, _iteratorNormalCompletion4, _didIteratorError4, _iteratorError4, _iterator4, _step4, _path;

    return _regenerator2.default.wrap(function _callee2$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            // Assign `HOST` in scope.
            HOST = 'http://localhost:' + port;

            // Copy all files to a temp folder and set the source path.

            sourcePath = join(targetPath, '.tmp_prerender');
            _context3.next = 4;
            return exists(sourcePath);

          case 4:
            if (!_context3.sent) {
              _context3.next = 7;
              break;
            }

            _context3.next = 7;
            return del([sourcePath]);

          case 7:
            _context3.next = 9;
            return function () {
              return new _promise2.default(function (resolve, reject) {
                ncp(targetPath, sourcePath, {
                  filter: /^((?!\.tmp_prerender).)*$/ // Ignore .tmp_prerender directory.
                }, function (err) {
                  if (err) {
                    // LOG.error(err)
                    reject(err);
                  }
                  resolve(true);
                });
              });
            }();

          case 9:

            // Starting an Express.js server to serve the static files.
            app = express();

            // Getting the HTML content from the index.html file

            _context3.next = 12;
            return readFile(join(sourcePath, 'index.html'));

          case 12:
            index = _context3.sent.toString();


            // Serving the static files.
            app.get('*.*', express.static(sourcePath));

            // Serving index.html, when puppeter requests the index page.
            app.get('*', function (req, res) {
              return res.send(index);
            });

            // Starting the express server.
            _context3.next = 17;
            return new _promise2.default(function (resolve, reject) {
              var s = app.listen(port, function (e) {
                return e ? reject(e) : resolve(s);
              });
            });

          case 17:
            server = _context3.sent;


            LOG.info('Started server ' + HOST);

            // Launching Puppeteer.
            _context3.next = 21;
            return puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });

          case 21:
            browser = _context3.sent;


            LOG.info('Started browser.');

            // Creating a new Page.
            _context3.next = 25;
            return browser.newPage();

          case 25:
            page = _context3.sent;

            // Remove leading slashes from the path.
            removeLeadingSlash = function removeLeadingSlash(path) {
              return path.replace(/^\/*/gi, '');
            };

            // Function for saving the rendered page.


            savePage = function () {
              var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(path, pageHtml) {
                var pathValid, matched, file, dir;
                return _regenerator2.default.wrap(function _callee$(_context) {
                  while (1) {
                    switch (_context.prev = _context.next) {
                      case 0:
                        // Verify if path is valid in vue-router.
                        pathValid = true;

                        if (!options.verifyPaths) {
                          _context.next = 6;
                          break;
                        }

                        _context.next = 4;
                        return page.evaluate(function (path) {
                          return window._vuePrerender.$router.match(path).matched.length;
                        }, path);

                      case 4:
                        matched = _context.sent;


                        if (matched === undefined) {
                          pathValid = true; // `vue-router` not found, accept all paths.
                        } else if (matched === 0) {
                          pathValid = false;
                        }

                      case 6:
                        if (!pathValid) {
                          _context.next = 23;
                          break;
                        }

                        // Defining the HTML file name that will be added.
                        file = join(targetPath, path || '', 'index.html');
                        dir = dirname(file);

                        // Beautify code if `tidy` is set to true in options.

                        if (!options.tidy) {
                          _context.next = 13;
                          break;
                        }

                        _context.next = 12;
                        return function () {
                          return new _promise2.default(function (resolve, reject) {
                            tidy(pageHtml, options.tidyOptions, function (err, html) {
                              if (err) {
                                LOG.error(err.message);
                                reject(err);
                              } else {
                                resolve(html);
                              }
                            });
                          });
                        }();

                      case 12:
                        pageHtml = _context.sent;

                      case 13:
                        _context.next = 15;
                        return exists(dir);

                      case 15:
                        if (_context.sent) {
                          _context.next = 18;
                          break;
                        }

                        _context.next = 18;
                        return mkdirp(dir);

                      case 18:
                        _context.next = 20;
                        return writeFile(file, pageHtml);

                      case 20:

                        LOG.info('Saved: ' + file);
                        _context.next = 24;
                        break;

                      case 23:
                        LOG.warning('Skipped (invalid path):  ' + path);

                      case 24:
                      case 'end':
                        return _context.stop();
                    }
                  }
                }, _callee, _this);
              }));

              return function savePage(_x4, _x5) {
                return _ref2.apply(this, arguments);
              };
            }();

            // Function for removing ignored paths.


            removeIgnoredPaths = function removeIgnoredPaths(paths) {
              paths = paths.filter(function (path) {
                var pathIgnored = false;
                var _iteratorNormalCompletion = true;
                var _didIteratorError = false;
                var _iteratorError = undefined;

                try {
                  for (var _iterator = (0, _getIterator3.default)(options.pathExceptions), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                    var _exception = _step.value;

                    if (_exception instanceof RegExp) {
                      var result = _exception.test(path);

                      if (result) {
                        LOG.info('Ignored path (by RegExp): ' + path);
                        pathIgnored = true;
                        break;
                      }
                    } else {
                      if (path.indexOf(_exception) === 0) {
                        LOG.info('Ignored path (by string): ' + path);
                        pathIgnored = true;
                        break;
                      }
                    }
                  }
                } catch (err) {
                  _didIteratorError = true;
                  _iteratorError = err;
                } finally {
                  try {
                    if (!_iteratorNormalCompletion && _iterator.return) {
                      _iterator.return();
                    }
                  } finally {
                    if (_didIteratorError) {
                      throw _iteratorError;
                    }
                  }
                }

                return !pathIgnored;
              });

              return paths;
            };

            removeIgnoredURLs = function removeIgnoredURLs(paths) {
              // Remove ignored paths.
              paths = paths.filter(function (path) {
                var pathIgnored = false;
                var _iteratorNormalCompletion2 = true;
                var _didIteratorError2 = false;
                var _iteratorError2 = undefined;

                try {
                  for (var _iterator2 = (0, _getIterator3.default)(options.urlExceptions), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                    var _exception = _step2.value;

                    if (_exception instanceof RegExp) {
                      var result = _exception.test(path);

                      if (result) {
                        LOG.info('Ignored URL (by RegExp): ' + path);
                        pathIgnored = true;
                        break;
                      }
                    } else {
                      if (path.indexOf(_exception) === 0) {
                        LOG.info('Ignored URL (by string): ' + path);
                        pathIgnored = true;
                        break;
                      }
                    }
                  }
                } catch (err) {
                  _didIteratorError2 = true;
                  _iteratorError2 = err;
                } finally {
                  try {
                    if (!_iteratorNormalCompletion2 && _iterator2.return) {
                      _iterator2.return();
                    }
                  } finally {
                    if (_didIteratorError2) {
                      throw _iteratorError2;
                    }
                  }
                }

                return !pathIgnored;
              });

              return paths;
            };

            // Functionality of three main options.


            if (!options.catchPaths) {
              _context3.next = 45;
              break;
            }

            // Pre-render pages by catching all links from pages recursively.
            _pages = [''];
            _renderedPages = [];

          case 33:
            path = _pages[0];

            // Requesting the first page in `_pages` array.

            _context3.next = 36;
            return page.goto(HOST + '/' + removeLeadingSlash(path));

          case 36:
            _context3.next = 38;
            return page.evaluate(function () {
              return document.documentElement.outerHTML;
            });

          case 38:
            result = _context3.sent;
            _context3.next = 41;
            return savePage(path, result);

          case 41:

            // Add current page to the `_renderedPages` array.
            _renderedPages = [].concat((0, _toConsumableArray3.default)(_renderedPages), [path]);

            // Set `_pages` with the pages that still need to be rendered.
            _pages = difference(uniq(_pages.concat(result.match(/href="\/[/\w\d-]*"/g).map(function (s) {
              return s.match(/\/([/\w\d-]*)/)[1];
            }))), _renderedPages);
            _pages = removeIgnoredPaths(_pages);

          case 44:
            if (_pages.length > 0) {
              _context3.next = 33;
              break;
            }

          case 45:
            if (!(options.paths && options.paths.length > 1)) {
              _context3.next = 85;
              break;
            }

            // Pre-render a list of pre-defined paths.
            _pages2 = options.paths;

            _pages2 = removeIgnoredPaths(_pages2);
            _renderedPages2 = [];
            _iteratorNormalCompletion3 = true;
            _didIteratorError3 = false;
            _iteratorError3 = undefined;
            _context3.prev = 52;
            _iterator3 = (0, _getIterator3.default)(_pages2);

          case 54:
            if (_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done) {
              _context3.next = 69;
              break;
            }

            _page = _step3.value;

            if (_renderedPages2.includes(_page)) {
              _context3.next = 66;
              break;
            }

            _path2 = _page;
            _context3.next = 60;
            return page.goto(HOST + '/' + removeLeadingSlash(_path2));

          case 60:
            _context3.next = 62;
            return page.evaluate(function () {
              return document.documentElement.outerHTML;
            });

          case 62:
            _result = _context3.sent;
            _context3.next = 65;
            return savePage(_path2, _result);

          case 65:

            _renderedPages2.push(_path2);

          case 66:
            _iteratorNormalCompletion3 = true;
            _context3.next = 54;
            break;

          case 69:
            _context3.next = 75;
            break;

          case 71:
            _context3.prev = 71;
            _context3.t0 = _context3['catch'](52);
            _didIteratorError3 = true;
            _iteratorError3 = _context3.t0;

          case 75:
            _context3.prev = 75;
            _context3.prev = 76;

            if (!_iteratorNormalCompletion3 && _iterator3.return) {
              _iterator3.return();
            }

          case 78:
            _context3.prev = 78;

            if (!_didIteratorError3) {
              _context3.next = 81;
              break;
            }

            throw _iteratorError3;

          case 81:
            return _context3.finish(78);

          case 82:
            return _context3.finish(75);

          case 83:
            _context3.next = 125;
            break;

          case 85:
            if (!options.parseRouter) {
              _context3.next = 124;
              break;
            }

            _context3.next = 88;
            return page.goto(HOST + '/');

          case 88:
            _context3.next = 90;
            return page.evaluate(function () {
              var _paths = [];
              if (!window._vuePrerender) {
                return 'GLOBAL_VAR_UNDEFINED';
              } else if (!window._vuePrerender.$router) {
                return 'ROUTER_UNDEFINED';
              } else if (window._vuePrerender.$router.mode !== 'history') {
                return 'ROUTER_NOT_HISTORY_MODE';
              } else {
                if (window._vuePrerender.$i18nRoutes) {
                  window._vuePrerender.$i18nRoutes.forEach(function (_route) {
                    _paths.push(_route.path);
                  });
                } else {
                  window._vuePrerender.$router.options.routes.forEach(function (_route) {
                    _paths.push(_route.path);
                  });
                }

                return _paths;
              }
            });

          case 90:
            paths = _context3.sent;
            pathsSet = true;

            if (paths === 'GLOBAL_VAR_UNDEFINED') {
              LOG.error('Global `window._vuePrerender` variable not defined (please refer to the documentation).');
              pathsSet = false;
            } else if (paths === 'ROUTER_UNDEFINED') {
              LOG.error('`vue-router` not defined.');
              pathsSet = false;
            } else if (paths === 'ROUTER_NOT_HISTORY_MODE') {
              LOG.error('`vue-router` not in `history` mode (please refer to the documentation).');
              pathsSet = false;
            }

            if (!pathsSet) {
              _context3.next = 122;
              break;
            }

            paths = removeIgnoredPaths(paths);

            mockAllParams = function mockAllParams(path, keys) {
              // Generate paths based on generated parameter combination and render valid paths.
              var toPath = pathToRegexp.compile(path);

              var _paths = [];
              var allValidCombinations = comboWizard(options.routerParams, keys);
              allValidCombinations.forEach(function (params) {
                try {
                  _paths.push(toPath(params));
                } catch (err) {
                  LOG.error(path + ' -> ' + err.message);
                }
              });
              _paths = removeIgnoredURLs(_paths);

              return _paths;
            };

            // Save HTML files for all possible paths.


            _loop = /*#__PURE__*/_regenerator2.default.mark(function _loop(_path) {
              var keys, allPaths, _iteratorNormalCompletion5, _didIteratorError5, _iteratorError5, _iterator5, _step5, _path3, _result2;

              return _regenerator2.default.wrap(function _loop$(_context2) {
                while (1) {
                  switch (_context2.prev = _context2.next) {
                    case 0:
                      keys = [];

                      pathToRegexp(_path, keys);

                      keys.forEach(function (_key) {
                        keys.push(_key.name);
                      });

                      allPaths = [_path];

                      if (keys.length > 0) {
                        allPaths = mockAllParams(_path, keys);
                      }

                      _iteratorNormalCompletion5 = true;
                      _didIteratorError5 = false;
                      _iteratorError5 = undefined;
                      _context2.prev = 8;
                      _iterator5 = (0, _getIterator3.default)(allPaths);

                    case 10:
                      if (_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done) {
                        _context2.next = 22;
                        break;
                      }

                      _path3 = _step5.value;
                      _context2.next = 14;
                      return page.goto(HOST + '/' + removeLeadingSlash(_path3));

                    case 14:
                      _context2.next = 16;
                      return page.content();

                    case 16:
                      _result2 = _context2.sent;
                      _context2.next = 19;
                      return savePage(_path3, _result2);

                    case 19:
                      _iteratorNormalCompletion5 = true;
                      _context2.next = 10;
                      break;

                    case 22:
                      _context2.next = 28;
                      break;

                    case 24:
                      _context2.prev = 24;
                      _context2.t0 = _context2['catch'](8);
                      _didIteratorError5 = true;
                      _iteratorError5 = _context2.t0;

                    case 28:
                      _context2.prev = 28;
                      _context2.prev = 29;

                      if (!_iteratorNormalCompletion5 && _iterator5.return) {
                        _iterator5.return();
                      }

                    case 31:
                      _context2.prev = 31;

                      if (!_didIteratorError5) {
                        _context2.next = 34;
                        break;
                      }

                      throw _iteratorError5;

                    case 34:
                      return _context2.finish(31);

                    case 35:
                      return _context2.finish(28);

                    case 36:
                    case 'end':
                      return _context2.stop();
                  }
                }
              }, _loop, _this, [[8, 24, 28, 36], [29,, 31, 35]]);
            });
            _iteratorNormalCompletion4 = true;
            _didIteratorError4 = false;
            _iteratorError4 = undefined;
            _context3.prev = 100;
            _iterator4 = (0, _getIterator3.default)(paths);

          case 102:
            if (_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done) {
              _context3.next = 108;
              break;
            }

            _path = _step4.value;
            return _context3.delegateYield(_loop(_path), 't1', 105);

          case 105:
            _iteratorNormalCompletion4 = true;
            _context3.next = 102;
            break;

          case 108:
            _context3.next = 114;
            break;

          case 110:
            _context3.prev = 110;
            _context3.t2 = _context3['catch'](100);
            _didIteratorError4 = true;
            _iteratorError4 = _context3.t2;

          case 114:
            _context3.prev = 114;
            _context3.prev = 115;

            if (!_iteratorNormalCompletion4 && _iterator4.return) {
              _iterator4.return();
            }

          case 117:
            _context3.prev = 117;

            if (!_didIteratorError4) {
              _context3.next = 120;
              break;
            }

            throw _iteratorError4;

          case 120:
            return _context3.finish(117);

          case 121:
            return _context3.finish(114);

          case 122:
            _context3.next = 125;
            break;

          case 124:
            LOG.error('Pre-rendering couldn\'t be started because these three configuration options are all set to false: `parseRouter`, `paths`, `catchPaths`. Please refer to the documentation.');

          case 125:

            // Close Chromium and the express server.
            browser.close();
            server.close();

            // Delete `.tmp` directory.
            _context3.next = 129;
            return del([sourcePath]);

          case 129:
          case 'end':
            return _context3.stop();
        }
      }
    }, _callee2, this, [[52, 71, 75, 83], [76,, 78, 82], [100, 110, 114, 122], [115,, 117, 121]]);
  }));

  return function main(_x, _x2, _x3) {
    return _ref.apply(this, arguments);
  };
}();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*!
 * vue-prerender v0.0.5
 * Copyright (c) 2017-present, Eldar Cejvanovic
 * License: MIT
 * Inspired by: https://blog.cloudboost.io/prerender-an-angular-application-with-angular-cli-and-puppeteer-25dede2f0252
 */
var colors = require('colors');
var puppeteer = require('puppeteer');
var express = require('express');

var _require = require('path'),
    join = _require.join,
    dirname = _require.dirname;

var pathToRegexp = require('path-to-regexp');

var _require2 = require('mz/fs'),
    readFile = _require2.readFile,
    exists = _require2.exists,
    writeFile = _require2.writeFile;

var del = require('del');

var _require3 = require('ncp'),
    ncp = _require3.ncp;

var mkdirp = require('mkdirp-promise');

var _require4 = require('lodash'),
    uniq = _require4.uniq,
    difference = _require4.difference,
    merge = _require4.merge;

var comboWizard = require('combo-wizard');

var _require5 = require('htmltidy2'),
    tidy = _require5.tidy;

var portfinder = require('portfinder');

// Default port.
var DEFAULT_PORT = 4848;

// Browser and server so that it can be closed anywhere.
var browser = void 0;
var server = void 0;

// Log options.
var LOG = {
  level: 0,
  error: function error(message) {
    if (this.level >= 1) {
      console.log(colors.red('[vue-prerender] [error]   => ' + message));
    }
  },
  warning: function warning(message) {
    if (this.level >= 2) {
      console.log(colors.yellow('[vue-prerender] [warning] => ' + message));
    }
  },
  info: function info(message) {
    if (this.level >= 3) {
      console.log(colors.cyan('[vue-prerender] [info]    => ' + message));
    }
  }

  // Main function.
};

var _defaultOptions = {
  logLevel: 3, // 0 - no log output; 1 - just errors; 2 - errors and warnings; 3 - all output
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
    'wrap-sections': false // Beautify HTML.
  } };

var _parseOptions = function _parseOptions(options) {
  if (options.logLevel !== 0 && options.logLevel !== 1 && options.logLevel !== 2 && options.logLevel !== 3) {
    options.logLevel = 0;
  }

  options.parseRouter = !!options.parseRouter;

  if (!(options.pathExceptions instanceof Array)) {
    if (typeof options.pathExceptions === 'string') {
      options.pathExceptions = [options.pathExceptions];
    } else {
      options.pathExceptions = [];
    }
  }

  if (!(options.urlExceptions instanceof Array)) {
    if (typeof options.urlExceptions === 'string') {
      options.urlExceptions = [options.urlExceptions];
    } else {
      options.urlExceptions = [];
    }
  }

  if (!((0, _typeof3.default)(options.routerParams) === 'object')) {
    options.routerParams = {};
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
  var _checkArray = function _checkArray(_arr) {
    for (var i in _arr) {
      if (_arr[i] === '') {
        _arr[i] = undefined;
      }
    }

    return _arr;
  };

  if (!(options.paths instanceof Array)) {
    if (typeof options.paths === 'string') {
      options.paths = [options.paths];
    } else {
      options.paths = [];
    }
  }

  options.catchPaths = !!options.catchPaths;
  options.verifyPaths = !!options.verifyPaths;
  options.tidy = !!options.tidy;

  if (!((0, _typeof3.default)(options.tidyOptions) === 'object')) {
    options.tidyOptions = {};
  }

  return options;
};

var _vuePrerender = function _vuePrerender(targetPath, _options, cb) {
  targetPath = join(process.cwd(), targetPath);

  var options = {};
  merge(options, _defaultOptions);
  merge(options, _options);
  options = _parseOptions(options);
  LOG.level = options.logLevel;

  // Run the main function.
  portfinder.basePort = DEFAULT_PORT;
  portfinder.getPortPromise().then(function (port) {
    main(port, targetPath, options).then(function () {
      LOG.info('Prerendering finished.');

      // Callback
      if (typeof cb === 'function') {
        cb();
      }
    }).catch(function (err) {
      LOG.error(err);

      // Close Chromium and the express server.
      if (browser && browser.close) {
        browser.close();
      }

      if (server && server.close) {
        server.close();
      }

      // Callback
      if (typeof cb === 'function') {
        cb();
      }
    });
  }).catch(function (err) {
    LOG.error(err);

    // Close Chromium and the express server.
    if (browser && browser.close) {
      browser.close();
    }

    if (server && server.close) {
      server.close();
    }

    // Callback
    if (typeof cb === 'function') {
      cb();
    }
  });
};

module.exports = _vuePrerender;
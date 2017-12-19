import gulp from 'gulp'
import babel from 'gulp-babel'
import sequence from 'run-sequence'
import del from 'del'
import colors from 'colors'
import webpack from 'webpack-stream'

gulp.task('default', done => sequence(['clean'], ['build'], done))

gulp.task('clean', () => del(['lib']))

gulp.task('build', ['build:lib'])

gulp.task('build:lib', () => {
  return gulp.src(['src/**/*.js'])
    .pipe(babel({
      presets: ['env']
    }))
    .on('error', function (error) {
      console.log(error.stack)
      this.emit('end')
    })
    .pipe(gulp.dest('lib'))
})

gulp.task('xbuild:lib', () => {
  return gulp.src(['babel-polyfill', 'src/prerender.js'])
    .pipe(webpack({
      module: {
        rules: [
          {
            test: /\.js$/,
            exclude: /(node_modules)/,
            use: {
              loader: 'babel-loader',
              options: {
                presets: ['env']
              }
            }
          }
        ]
      }
    }))
    .pipe(gulp.dest('lib/'))
})

gulp.task('watch', ['build:lib'], () => {
  const watcher = gulp.watch(['src/**/*.js'], ['build:lib'])

  watcher.on('change', (obj) => {
    const _path = obj.path.split('/')
    let path = []

    if (_path[_path.length - 3]) {
      path.push(_path[_path.length - 3])
    }

    if (_path[_path.length - 2]) {
      path.push(_path[_path.length - 2])
    }

    if (path.length > 0) {
      path = path.join('/')
    }

    console.log(colors.yellow(`[vue-gettext-tools] [watcher] => File "${path}" was changed.`))
  })
})

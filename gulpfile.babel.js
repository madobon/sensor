import gulp from 'gulp'
import babel from 'gulp-babel'

// html
gulp.task('html', function () {
  return gulp.src('src/**.html')
    .pipe(gulp.dest('dist'));
});

// babel
gulp.task('babel', () => {
  return gulp.src('src/**.js')
    .pipe(babel())
    .pipe(gulp.dest('dist'));
});

// default
gulp.task('default', ['html', 'babel']);

/*
 * @Author: 
 * @Date:   
 * @Last Modified by:   
 * @Last Modified time:
 */

'use strict'
/**
 * 1. LESS/SASSS 编译 压缩 合并
 * 2. JS合并 压缩 混淆
 * 3. img复制
 * 4. html压缩
 * 5. plugin复制
 * 6. 清空历史文件
 * 7. browserSync Server
 */

// 在gulpfile中先载入gulp包，因为这个包提供了一些API
const gulp = require('gulp');

// const minifyCSS = require('gulp-minify-css');
const cssnano = require('gulp-cssnano');

// const md5 = require('gulp-md5-plus');
const gutil = require('gulp-util');
const autoprefixer = require('gulp-autoprefixer');
const browserSync = require('browser-sync');
const sourcemaps = require('gulp-sourcemaps');

// 1. scss编译 压缩 --合并没有必要，一般预处理CSS都可以导包
const scss = require('gulp-scss');
const less = require('gulp-less');

gulp.task('style', function() {
    // 这里是在执行style任务时自动执行的
    return gulp.src(['src/assets/css/*.css', '!src/assets/css/_*.scss'])
        // .pipe(scss())
        .pipe(autoprefixer())
        .pipe(cssnano())
        .pipe(gulp.dest('build/assets/css/'))
        .pipe(browserSync.reload({
            stream: true
        }));
});

// 2. JS合并 压缩混淆
const concat = require('gulp-concat');
const uglify = require('gulp-uglify');
const babel = require('gulp-babel');

gulp.task('script', function() {
    return gulp.src('src/assets/scripts/*.js')
        .pipe(sourcemaps.init())
        .pipe(babel())
        .pipe(concat('bundle.js'))
        .pipe(uglify())
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('build/assets/scripts'))
        .pipe(browserSync.reload({
            stream: true
        }));
});

// 3. 图片复制
gulp.task('image', function() {
    return gulp.src('src/assets/images/*.*')
        .pipe(gulp.dest('build/assets/images'))
        .pipe(browserSync.reload({
            stream: true
        }));
});

// 4. HTML
const htmlmin = require('gulp-htmlmin');

gulp.task('html', function() {
    return gulp.src(['src/**/*.html', '!src/assets/plugins/**/*.html'])
        .pipe(htmlmin({
            collapseWhitespace: true,
            removeComments: true
        }))
        .pipe(gulp.dest('build'))
        .pipe(browserSync.reload({
            stream: true
        }));
});

// 5. plugin 处理
gulp.task('plugins', function() {
    return gulp.src(['src/assets/plugins/**/*.js', 'src/assets/plugins/**/*.css', 'src/assets/plugins/**/fontawesome-webfont.*'])
        .pipe(gulp.dest('build/assets/plugins'))
        .pipe(browserSync.reload({
            stream: true
        }));
});

// 6. 清空
const clean = require('gulp-clean');

gulp.task('clean', function() {
    return gulp.src(['./build/assets/css', './build/assets/scripts', './build/assets/images'], { read: false })
        .pipe(clean());
});

// 默认任务，清空图片、样式、js 并重建
gulp.task('default', ['clean', 'plugins'], function() {
    gulp.start('html', 'style', 'image', 'script')
});

gulp.task('serve', ['default'], function() {
    browserSync({
        server: {
            baseDir: ['build']
        },
    }, function(err, bs) {
        console.log(bs.options.getIn(["urls", "local"]));
    });

    gulp.watch('src/assets/css/*.scss', ['style']);
    gulp.watch('src/assets/scripts/*.js', ['script']);
    gulp.watch('src/assets/images/*.*', ['image']);
    gulp.watch('src/**/*.html', ['html']);
});

/*
 * grunt-data-uri
 * http://github.com/ahomu/grunt-data-uri
 * http://aho.mu
 *
 * Copyright (c) 2012 ahomu
 * Licensed under the MIT license.
 */
module.exports = function (grunt) {

    'use strict';

    var fs = require('fs'),
        path = require('path'),
        datauri = require('datauri');

    var RE_CSS_URLFUNC = /(?:url\(["']?)(.*?)(?:["']?\))/,
        util = grunt.util || grunt.utils, // for 0.4.0
        gruntfileDir = path.resolve('./');

    grunt.registerMultiTask('dataUri', 'Convert your css file image path!!', function () {
        // @memo this.file(0.3.x), this.files(0.4.0a) -> safe using this.data.src|dest

        var options = this.data.options,
            cssFiles = grunt.file.expand({filter: 'isFile'}, this.data.src),
            destDir = path.resolve(this.data.dest),
            imageFiles = [];

        options.imageExtensions = options.imageExtensions ? options.imageExtensions : ['jpg','png','gif'];
        options.imageExtensionRegex = options.imageExtensionRegex ? options.imageExtensionRegex : createImgExtensionRegex(options.imageExtensions);
        options.maxBytes = options.maxBytes ? options.maxBytes : '2048';

        grunt.file.expand({filter: 'isFile'}, options.target).forEach(function (imgPath) {
            grunt.log.ok('path ' + path.resolve(imgPath));
            imageFiles.push(path.resolve(imgPath));
        });

        grunt.log.ok('imageFiles ' + imageFiles.length);

        cssFiles.forEach(function (src) {
            var content = grunt.file.read(src),
                matches = content.match(new RegExp(RE_CSS_URLFUNC.source, 'g')),
                outputTo = destDir + '/' + path.basename(src),
                baseDir,
                uris;

            // Detect baseDir for using traversal image files
            baseDir = options.baseDir ? path.resolve(options.baseDir)    // specified base dir
                : path.resolve(path.dirname(src)); // detected from src

            // Not found image path
            if (!matches) {
                grunt.log.subhead('SRC: file uri not found on ' + src);
                grunt.file.write(outputTo, content);
                grunt.log.ok('Skipped');
                grunt.log.ok('=> ' + outputTo);
                return;
            }

            // Change base to src(css, html, js) existing dir
            grunt.file.setBase(baseDir);

            // List uniq image URIs
            uris = util._.uniq(matches.map(function (m) {
                return m.match(RE_CSS_URLFUNC)[1];
            }));

            // Exclude external http resource
            uris = uris.filter(function (u) {
                return !u.match('(data:|http)');
            });

            // Exclude non image extensions
            uris = uris.filter(function (u) {
                return u.match(options.imageExtensionRegex);
            });

            grunt.log.subhead('SRC: ' + uris.length + ' file uri found on ' + src);

            // Process urls
            uris.forEach(function (uri) {
                var replacement,
                    needle,
                    fixedUri = fixUri(uri);

                // Resolve image realpath
                needle = path.resolve(fixedUri);

                // Assume file existing cause found from haystack
                if (imageFiles.indexOf(needle) !== -1) {
                    // check if file exceeds the max bytes
                    replacement = needle;
                } else {
                    // Diff of directory level
                    replacement = adjustDirectoryLevel(fixedUri, destDir, baseDir);
                    grunt.log.ok('Adjust: ' + fixedUri + ' -> ' + replacement);
                }

                var fileSize = getFileSize(replacement);
                grunt.log.ok('filesize: ' + fileSize);
                if (!fileSize){
                    grunt.log.warn('file not found. ' + replacement);
                    replacement = false;
                }

                if(fileSize > options.maxBytes) {
                    // file is over the max size
                    grunt.log.warn('Skipping (size ' + fileSize + ' > ' + options.maxBytes + '): ' + replacement);
                    replacement = false;
                }

                if(replacement){
                    // Encoding to Data uri
                    grunt.log.ok('Encode: ' + replacement);
                    replacement = datauri(replacement);
                    content = content.replace(new RegExp(uri, 'g'), replacement);
                }
            });

            // Revert base to gruntjs executing current dir
            grunt.file.setBase(gruntfileDir);
            grunt.file.write(outputTo, content);
            grunt.log.ok('=> ' + outputTo);
        });
    });

    /**
     *
     * @param imageExtensions
     * @returns {*|string}
     */
    function createImgExtensionRegex(imageExtensions){
        if(imageExtensions.length == 0){
            return [];
        }
        imageExtensions[0] = '\\.' + imageExtensions[0];
        return imageExtensions.join('|\\.');
    }

    /**
     * @param fullPath
     * @param options
     * @return {boolean} the file size, or undefined if not found
     */
    function getFileSize(fullPath) {
        if (!fs.existsSync(fullPath)) {
            return false;
        }

        var stats = fs.statSync(fullPath);
        if (!stats.isFile()) {
            return false;
        }
        return stats.size;
    }

    /**
     * @method adjustDirectoryLevel
     * @param {String} relativePath
     * @param {String} toDir
     * @param {String} fromDir
     * @return {String} resolvedPath
     */
    function adjustDirectoryLevel(relativePath, toDir, fromDir) {
        // fix ../path/to/img.jpg to path/to/img.jpg
        var resolvedPath = relativePath.replace(/^\.\//, '');

        if (toDir === fromDir) {
            // both toDir and fromDir are same base.
        }
        else if (fromDir.indexOf(toDir) === 0) {
            // fromDir is shallow than toDir
            path.relative(fromDir, toDir).split('/').forEach(function () {
                resolvedPath = resolvedPath.replace(/^\.\.\//, '');
            });
        }
        else if (toDir.indexOf(fromDir) === 0) {
            // toDir is depp than fromDir
            path.relative(fromDir, toDir).split('/').forEach(function () {
                resolvedPath = '../' + resolvedPath;
            });
        }

        return resolvedPath;
    }

    function fixUri(uri){
        // fixed current dir when specified uri is like root
        if(uri.indexOf('/') === 0){
            return '.' + uri;
        }

        return uri;
    }
};
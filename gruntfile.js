/* globals module */

module.exports = function(grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		'http-server': {
			'dev': {
				port: 3000,
				cache: -1
			}
		},
		'uglify': {
			all: {
				files: {
					'flumen.min.js': ['flumen.js']
				},
				options: {
					preserveComments: 'some'
				}
			}
		},
		'bytesize': {
			all: {
				src: ['flumen.min.js']
			}
		}
	});
	grunt.loadNpmTasks('grunt-http-server');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-bytesize');
};
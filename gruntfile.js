module.exports = function(grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		'http-server': {
			'dev': {
				port: 3000,
				cache: -1
			}
		}
	});
	grunt.loadNpmTasks('grunt-http-server');
};
module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    concat: {
      dist: {
        src: ['lib/*.js', 'src/*.js'],
        dest: 'build/maptastic.js',
      }
    },
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
      },
      build: {
        src: 'build/maptastic.js',
        dest: 'build/maptastic.min.js'
      }
    },
    watch: {
      scripts: {
        files: ['src/*.js'],
        tasks: ['default'],
        options: {
          spawn: false
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-concat');

  
  grunt.registerTask('default', ['concat', 'uglify']);
  grunt.registerTask('dev', ['concat']);
};

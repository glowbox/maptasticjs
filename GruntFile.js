module.exports = function (grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    babel: {
      options: {
        sourceMap: true,
        presets: ['env']
      },
      dist: {
        files: {
          'dist/maptastic.js': 'dist/maptastic.js'
        }
      }
    },
    browserify: {
      client: {
        src: ['src/maptastic.js'],
        dest: 'dist/maptastic.js',
      }
    },
    concat: {
      dist: {
        src: ['dist/maptastic.js', 'lib/*.js'],
        dest: 'dist/maptastic.js',
      }
    },
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
      },
      build: {
        src: 'dist/maptastic.js',
        dest: 'dist/maptastic.min.js'
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
  grunt.loadNpmTasks('grunt-babel');
  grunt.loadNpmTasks('grunt-browserify');

  // first bundle, then transpile, then minify
  grunt.registerTask('default', ['browserify', 'babel', 'uglify']);
  grunt.registerTask('dev', ['browserify']);
};

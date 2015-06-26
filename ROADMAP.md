This document provides an approximate roadmap for the Flumen project. All of this is, of course, subject to change.

# Version 0.3.0

* Fix bugs in the "h.each()" function, in particular:
    - Allow reordering
    - Allow insertions in the middle of an array
    - Make sure performing multiple operations at once works properly
* Rename things to make the API more intuitive
* Add tests (other than the simple one provided by "index.html")
* Add documentation for the entire API (and for installation)
* Get a fully working TodoMVC example working

# Version 0.5.0

* Move to an arrow-based approach to stream processing
* Give examples of "nested" components
* Allow "if" statements in component markup

# Version 1.0.0

* Run apps entirely within a web worker
* Provide a framework for adding communication with a backend
* Add routing and other useful features
* Make flumen stable enough for regular usage
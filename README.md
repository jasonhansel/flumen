# Flumen

Web applications can be thought of as stream processors, whose inputs are events from the DOM and whose outputs are commands that alter the DOM. This model can also be extended to include events sent to/from the server.

Flumen uses this as a starting point for a new approach for developing web applications. In particular, Flumen uses stream processors to represent elements in the DOM; however, since these processors are not real DOM elements, Flumen applications can be run entirely within web workers.

Furthermore, the use of "commands" to alter the DOM means that there is no need for a complicated diff algorithm (in most cases). It also means that approaches to stream processors based on Arrows (as used in FRP) can be used here as well.

Flumen is currently in a pre-release stage. Use at your own risk.
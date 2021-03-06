/*!
 * Flumen Pre-release
 */

/* globals document, define, module */
/* exported flumen */

(function (root, factory) {
	// See https://github.com/umdjs/umd/blob/master/returnExports.js
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
        root.flumen = factory();
  }
}(this, function () {

'use strict';

// 1. Scala-style classes
var Base = (function extender(xtends) {
	return function(fields) {
		var Constructor, abstract = (typeof fields !== 'string');


		// The Constructor is a space-separated list of fields.
		// So for example 'x y' is here equivalent to function(x,y){this.x=x,this.y=y}
		// This allows for much shorter class definitions
		if(!abstract) {
			fields = fields.split(' ');
			Constructor = function(obj) {
				var i = arguments.length;
				while(i--) {
					this[ fields[i] ] = arguments[i];
				}
				this.__asArguments = arguments;
				Object.freeze(this);
			};
		} else {
			Constructor = function() {
				throw Error('Can\'t create instances of method classes.');
			};
		}
		Constructor.prototype = Object.create(xtends.prototype);

		if(abstract) {
			for(var k in fields) {
				Constructor.prototype[k] = fields[k];
			}
			Constructor.extend = extender(Constructor);
		}

		Constructor.match = function(x) { return x && typeof x == 'object' &&  x instanceof Constructor; };
		Constructor.prototype.constructor = Constructor;

		return Constructor;
	};
})(Object)({});


function superMatch(obj) {
	var value;
	return function res(type, fn) {
		if(arguments.length === 0) {
			throw new Error('NO cases matched!');
		} else if (type.match(obj)) {
			if(fn === true) {
				// If the second argument is "true", just pass through
				value = obj;
			} else {
				value = fn.apply(obj, obj.__asArguments);
			}
			return function dn() {
				return arguments.length ? dn : value;
			};
		} else {
			return res;
		}
	};
}


// HTML Tags and Attributes List =====

var EventData = Base.extend('data');
var StatePair = Base.extend('old new');

var TagSpec = Base.extend('tag attrs events autoclose');

function parseTagSpec(tagspec, attrs)  {

	if(!tagspec) {
		tagspec = '';
	}
	if(!attrs) {
		attrs = {};
	}
	if(!attrs.class) {
		attrs.class = '';
	}

	var events = {},
		autoclose = false;

	for(var k in attrs) {
		if(/^on/.test(k)) {
			events[k.slice(2)] = attrs[k];
			delete attrs[k];
		}
	}

	var parts = /^(\w*)(.*)/.exec(tagspec);
	var tag = parts[1] || 'div';
	tagspec = parts[2];

	function addClass(part) {
		attrs.class = attrs.class.compose(fmap(function(x) {
			return x + ' ' + part.slice(1);
		}));
	}

	var part;
	while(tagspec) {
		if (/^\s*\/$/.test(tagspec)) {
			autoclose = true;
			tagspec = '';
		} else if(part = /^\.(\w|-)+/.exec(tagspec)) {
			part = part[0];

			if(typeof attrs.class == 'string') {
				attrs.class += ' ' + part.slice(1);
			} else {
				addClass(part);
			}
			tagspec = tagspec.slice(part.length);
		} else if (part = /^#(\w|-)+/.exec(tagspec)) {
			part = part[0];
			attrs.id = part.slice(1);
			tagspec = tagspec.slice(part.length);
		} else if (part = /^ (\w+)=((?:\w|-)+|\"[^"]*?\")/.exec(tagspec) ) {

			/* jshint -W110 */
			if(part[2][0] === '"' || part[2][0] === "'") {
			/* jshint +W110 */

				// Allow string escapes
				part[2] = JSON.parse(part[2]);
			}

			attrs[ part[1] ] = part[2];
			tagspec = tagspec.slice(part[0].length);
		} else if(tagspec) {
			throw new Error('Invalid tagspec');
		}
	}

	return new TagSpec(tag, attrs, events, autoclose);
}

function h(tagspec, att, slash) {
	var parsed = parseTagSpec(tagspec, att);
	var tag = parsed.tag,
		events = parsed.events,
		attrs = parsed.attrs;



	var result = function() {

		// each-syntax
		var children = [].slice.call(arguments);
		var merged = {};


		var eventFix = stateScan(function (state, data) {
			// console.log('GOT', state, data);
			return superMatch(data)
				(EventData, function(idata) {
					return new StateOut(state, new Just( new StateDiff( state, idata ) )) ;
				})
				(UniversalEvent, function(state) {
					return new StateOut(state, new Nothing());
				})
			();
		}, function() {
			return new StateOut(null, new Nothing());
		}).compose(maybeMap());

		function eventWrap(k) {
			var fn = events[k];
			return new StreamProcessor(function(sink) {
				return new Sink(function(val) {
					var arr = [];
					fn(val.diff, val.state, function () {
						var args = Array.prototype.slice.call(arguments);
						arr.push(new Bubble(new LoopFeedback(args)));
					});
					sink.event(arr);
				});
			});
		}

		for(var k in events) {
			merged[ 'events::' + k ] = eventFix.compose( eventWrap(k) ).compose(flatMap());
		}

		for(k in attrs) {
			merged[ 'attrs::' + k ] = StreamProcessor.match(attrs[k]) ? asText(attrs[k], true) : attrs[k];
		}

		children.forEach(function(child, index) {
			merged[ 'children::' + index ] = child;
		});

		merged = objectMap(merged, function(val, key) {

			if(!StreamProcessor.match(val)) {
				val = asText( constantize(val), key.indexOf('children::') === 0 ? false : true );
			}

			return val;
		});

		return fmap(function(stateL) {
				return superMatch(stateL)
					(EventData, function(data) {
						return new SpecificEvent('events::' + data.type, this);
					})
					(SpecificEvent, function(path, data) {
						return new SpecificEvent('children::' + path, data);
					})
					(UniversalEvent, true)
				();
			})
			.compose(enjoin(merged))
			.compose(fmap(function(sd) {
				return superMatch(sd)
					(Bubble, function() {
						return new Just(this);
					})
					(StateDiff, function(state, diff) {
						var children = [],
							patches = [];

						for(var k in state) {
							if(k.indexOf('attrs::') === 0) {
								patches.push(new SetAttributeCommand(k.slice(7), state[k]));
							}
							if(k.indexOf('children::') === 0) {
								children[k.slice(10) * 1] = state[k];
							}
						}

						Object.keys(events).forEach(function(k) {
							patches.push(new AttachEventCommand(k));
						});

						children.forEach(function(child, index) {
							patches.push(new AddFullDiffCommand(index,
								new NewChildCommand( child )
							));
						});


						var newState = new Creatable(tag, patches);


						return superMatch(diff)
							(OnChildCommand, function(path, command) {

								if(path.indexOf('attrs::') === 0) {
									path = path.slice(7);
									return new Just(
										new StateDiff(
											newState,
											new SetAttributeCommand(
												path,
												command.data
											)
										)
									);
								} else if(path.indexOf('children::') === 0) {
									path = path.slice(10) * 1;
									return new Just(
										new StateDiff(newState,
											new AddFullDiffCommand(path,
												new OnChildCommand(
													path,
													command
												)
											)
										)
									);
								} else {
									return new Nothing();
								}

							})
						();
					})
				();
			})).compose(maybeMap());
	};
	result.each = function(array, mapper, keyer) {
		var parent = result;
		return fmap(function(evt) {
			return new SpecificEvent('children', evt);
		}).compose(
			enjoin({
				parent: parent(),
				children:
				fmap(function(evt) {
					return superMatch(evt)
						(SpecificEvent, function() {
							return [ new SpecificEvent('right', this) ];
						})
						(UniversalEvent, function() {
							return [ new SpecificEvent('left', this) ];
						})
					();
				})
				.compose(flatMap())
				.compose(
					simpleEnjoin({
						left: fmap(function(x) {
								return superMatch(x)
									(UniversalEvent, function(data) {
										return data;
									})
								();
							})
							.compose(array)
							.compose(fmap(function(x) {
								return new StateDiff(x, null);
							})),
						right: fmap(function(x) { return x; })
					})
				)
				.compose(stateScan(function(state, v) {

					return superMatch(v)
						(Event, function(path, data) {
							return new StateOut(state, this);
						})
						(StateDiff, function(arrState, diff) {
							return superMatch(
									new StatePair(state.new.slice(0) , arrState.slice(0))
								)(StatePair, function(old, neww) {
									return new StateOut(this, diffArrays(
										old,
										neww,
										function(a, b) {
											return keyer(a) === keyer(b);
										}
									));
								})
							();
						})
					();
				}, function() {
					return new StateOut(
						new StatePair([], []),
						new StateDiff([], [])
					);
				}))
				.compose(new StreamProcessor(function(emit) {
					var childProcessors = {},
						stateByPosition = [],
						lastState = [];

					emit.event( new Just(new StateDiff([], null)) );

					return new Sink(function(arr) {
						superMatch(arr)
							(SpecificEvent, function(path, data) {
								childProcessors[path].event(data);
							})
							(StateDiff, function(state, diff) {

								lastState = state;

								diff.forEach(function(change) {
									superMatch(change)
										(InsertChange, function(index, value) {
											if(index !== arr.state.length - 1) {
												throw new Error('Can only insert at the end of an array!');
											}

											var notFirst = false,
												key = keyer(value);
											childProcessors[key] = mapper()
												.compose(fmap(function(v) {
													return superMatch(v)
														(Bubble, function(val) {
															return (new Just(this));
														})
														(StateDiff, function() {

															var loc = -1;
															for(var i = 0; i < lastState.length; i++) {
																if(keyer(lastState[i]) === key) {
																	loc = i;
																	break;
																}
															}

															stateByPosition[loc] = new AddFullDiffCommand(key, v.state);

															var oldNotFirst = notFirst;
															notFirst = true;

															return (
																new Just(new StateDiff(
																	stateByPosition,
																	new AddFullDiffCommand(
																		key,
																		oldNotFirst ?
																			new OnChildCommand(loc, v.diff) :
																			new NewChildCommand(v.state)
																	)
																))
															);

														})
													();
												}))
												.sender(emit);
										})
										(DeleteChange, function(index, value) {
											var key = keyer(value);
											stateByPosition.splice(index, 1);
											emit.event(new Just(
												new StateDiff(stateByPosition, new DeleteChildCommand(index))
											));
											delete childProcessors[key];
										})
										(ReorderChange, function(oldIndex, newIndex) {
											throw new Error('Reorders are not yet implemented');
										})
									();
								});

								state.forEach(function(x) {
									childProcessors[ keyer(x) ].event( new UniversalEvent(x) );
								});

							})
						();
					});
				})).compose(maybeMap())
			}))
			.compose(fmap(function(cmd) {
				return superMatch(cmd)
					(Bubble, true)
					(StateDiff, function(state, diff) {
						var parent = state.parent;
						return new StateDiff(
							new Creatable(parent.tag,
								parent.commands.concat(
									state.children
								)
							),
							diff.command
						);
					})
				();
			}));
	};

	if(parsed.autoclose) {
		return result();
	} else {
		return result;
	}
}

// Array diffing =====

var ArrayChange = Base.extend({}),
	DeleteChange  = ArrayChange.extend('index value'),
	InsertChange  = ArrayChange.extend('index value'),
	ReorderChange = ArrayChange.extend('oldIndex newIndex');

// Returns the sequences of ArrayChange's needed to transform
// the array "a" into the array "b."

// http://jsbin.com/xetoyufuke/1/edit?html,js,console,output
// http://jsperf.com/array-diff-simple/edit

function diffArrays(a, b, compare) {
	var origB = b;
	a = a.slice(0);
	b = b.slice(0);

	var instr = [],
		inserts = [];

	for(var k = 0; k < a.length; k++) {
		if( b.every(function(item) {
			return !compare(item, a[k]);
		}) ){
			instr.push(new DeleteChange(k, a[k]));
			a.splice(k--, 1);
		}
	}

	for(k = 0; k < b.length; k++) {
		if( a.every(function(item) {
			return !compare(item, b[k]);
		}) ) {
			inserts.push(new InsertChange(k, b[k]));
			b.splice(k--, 1);
		}
	}

	for(k = 0; k < b.length; k++) {
		if(!compare(a[k], b[k])) {
			instr.push(new ReorderChange(a.indexOf(b[k]), k));
			a.splice(k, 0, a.splice(b[k], 1)[0]);
		}
	}



	return new StateDiff(origB.slice(0), instr.concat(inserts.reverse()));
}


var Command = Base.extend({});
	var NewChildCommand = Command.extend('child');
	var CreateCommand = Command.extend('data');
	var OnChildCommand = Command.extend('path command');
	var SetAttributeCommand = Command.extend('name value');
	var DeleteChildCommand = Command.extend('index');
	var AddFullDiffCommand = Command.extend('code command');
	var AttachEventCommand = Command.extend('eventname');
	var SetTextCommand = Command.extend('text');


var Creatable = Base.extend({
	create: function(fullDiff, cb) {
		var elem = document.createElement(this.tag);
		this.commands.forEach(function(cmd) {
			runCommand(cmd, elem, fullDiff, cb);
		});
		return elem;
	}
}).extend('tag commands');

var StateDiff = Command.extend('state diff');


function objectMap(obj, fn) {
	var newObj = {};
	for (var key in obj) {
		newObj[key] = fn(obj[key], key, obj);
	}
	return newObj;
}

var Event  = Base.extend({});
	var SpecificEvent = Event.extend('path data');
	var UniversalEvent = Event.extend('data');
var Bubble = Base.extend('data');

function constantize(val) {
	return new StreamProcessor(function(sink) {
		sink.event(val);
		return new Sink(function(){});
	});
}

function simpleEnjoin(object, noDone) {
	return new StreamProcessor(function(sink) {
		var orderedSinks = objectMap(object, function(val) {
			return val.sender(sink);
		});
		return new Sink(function(stateL) {
			superMatch(stateL)
				(UniversalEvent, function() {
					for(var k in orderedSinks) {
						orderedSinks[k].event(this);
					}
				})
				(SpecificEvent, function(path, data) {
					orderedSinks[path].event(data);
				})
			();
		});
	});
}


var Maybe = Base.extend({});
	var Just = Maybe.extend('value');
	var Nothing = Maybe.extend('');



// Removed wrapAsync() and h.$iff

function enjoin(object) {
	return  simpleEnjoin(objectMap(object, function(val, key) {
				return val.compose(stateScan(function(first, value) {
					return new StateOut(false,
						{
							first: first,
							value: value,
							key: key
						}
					);
				}, function() {
					return new StateOut(true, {
						key: key,
						increment: true
					});
				}));
			}))
			.compose(stateScan(function(st, v) {

				if(v.increment) {
					if(v.key.indexOf('events::') !== 0) {
						st.init2++;
					}
					return new StateOut(st, new Nothing());
				}

				//  todo make sure st.init === st.init2 always; then switch to init2 entirely...

				var value = v.value,
					key = v.key,
					first = v.first;

				return superMatch(value)
					(Bubble, function() {
						return new StateOut(st, new Just(this));
					})
					(StateDiff, function(istate, diff) {
						st.vals[key] = istate;

						if(first) {
							st.init--;
							st.init2--;
						}

						if(st.init > 0) {
							return new StateOut(st, new Nothing());
						}

						return new StateOut(
							st,
							new Just(
								new StateDiff(
									st.vals,
									new OnChildCommand(key, diff)
								)
							)
						);
					})
				();

			}, function() {
				var init = 0;
				for(var k in object) {
					if(k.indexOf('events::') !== 0) {
						init++;
					}
				}

				return new StateOut({
					vals: {},
					init: init,
					init2: 0,
					id: Math.floor( Math.random()*10000 )
				}, new Nothing());
			}))
			.compose(maybeMap());

}

function runCommand(ch, node, fullDiff, cb) {
	superMatch(ch)
		(SetAttributeCommand, function(name, value) {
			if(name == 'checked') {
				node.checked = value;
			} else if(name == 'value') {
				if(node.value !== value) {
					node.value = value;
				}
			} else {
				node.setAttribute(name, value);
			}
		})
		(NewChildCommand, function(child) {
			node.appendChild(child.create(fullDiff, cb));
		})
		(DeleteChildCommand, function(index) {
			node.removeChild(node.childNodes[index]);
		})
		(CreateCommand, function(state) {
			node.parentNode.replaceChild(state.create(), node);
		})
		(AddFullDiffCommand, function(code, command) {
			runCommand(command, node, fullDiff.concat(code), cb);
		})
		(OnChildCommand, function(path, command) {
			runCommand(command, node.childNodes[path], fullDiff, cb);
		})
		(AttachEventCommand, function(eventname) {
			node.addEventListener(eventname, function(e) {
				cb(fullDiff, e);
			}, false);
		})
		(SetTextCommand, function(text) {
			if ('innerText' in node) {
				node.innerText = text;
			} else {
				node.textContent = text;
			}
		})
	();
}

var StreamProcessor = Base.extend({
	process: function(streamrun, sinkrun) {
		var sender = this.sender;
		return streamrun(sender(new Sink(sinkrun)));
	},
	compose: function(other) {
		var self = this;
		return new StreamProcessor(function(sink) {
			return self.sender(other.sender(sink));
		});
	}
}).extend('sender');

function fmap(fn) {
	return new StreamProcessor(function(sink) {
		return new Sink(function(val) {
			sink.event(fn(val));
		});
	});
}

// For debugging only
function slog(prefix) {
	return new StreamProcessor(function(sink) {
		return new Sink(function(val) {
			console.log('Debug message: ', prefix, val);
			sink.event(val);
		});
	});
}


function flatMap() {
	return new StreamProcessor(function(sink) {
		return new Sink(function(val) {
			val.forEach(sink.event.bind(sink));
		});
	});
}

function maybeMap() {
	return new StreamProcessor(function(sink) {
		return new Sink(function(val) {
			superMatch(val)
				(Just, function(v) {
					sink.event(v);
				})
				(Nothing, true)
			();
		});
	});
}

function prop(name) {
	return fmap(function(v) {
		return v[name];
	});
}

var Sink = Base.extend('event');



function scanner(accum, makeInit) {
	return new StreamProcessor(function(sink) {
		var state = makeInit();
		sink.event(state);
		return new Sink(function(val) {
			state = accum(state, val);
			sink.event(state);
		});
	});
}

var StateOut = Base.extend('state output');

// Like scanner but separates state from output.
function stateScan(accum, makeInit) {
	return new StreamProcessor(function(sink) {
		var state;
		superMatch(makeInit())
			(StateOut, function(newState, output) {
				state = newState;
				sink.event(output);
			})
		();
		return new Sink(function(val) {
			superMatch( accum(state, val) )
				(StateOut, function(newState, output) {
					state = newState;
					sink.event(output);
				})
			();
		});
	});
}


//Would something like this be useful?
// See: https://wiki.haskell.org/Circular_programming
// http://ac.els-cdn.com/S0167642399000234/1-s2.0-S0167642399000234-main.pdf?_tid=44e61862-e0c0-11e4-8a27-00000aab0f6b&acdnat=1428807892_b8e514bc06a12258d32adecf1fba5f7b
	// Discusses 'Stream processors!!!!'


var LoopFeedback = Base.extend('value');
var LoopIO = Base.extend('value');

function asText(processor, isAttr) {
	return new StreamProcessor(function(emit) {
		var last,
			first = true;

		var input = processor.sender(new Sink(function(v) {

			if(first || v !== last || typeof v === 'object' || typeof last === 'object') {
				last = v;
				if(!isAttr) {
					v = new Creatable('span', [
						new SetTextCommand(v + '')
					]);
				}
				emit.event(new StateDiff( v, new CreateCommand( v ) ));
				first = false;
			}

		}));
		return new Sink(function(val) {
			superMatch(val)
				(UniversalEvent, function(data) {
					input.event(data);
				})
				(SpecificEvent, function(){
					// NOP
				})
			();
		});
	});
}

function loop(streamfac) {
	return new StreamProcessor(
		function(sink) {
			var output = new Sink(function(v) {
					superMatch(v)
						(LoopFeedback, function(value) {
							inner.event(this);
						})
						(LoopIO, function(value) {
							sink.event(value);
						})
					();
				}),
				inner = streamfac.sender(output);
			return new Sink(function(val) {
				inner.event(new LoopIO(val));
			});
		}
	);
}


function makeCB(getTrigger) {
	return function cb(loc, evt) {
		getTrigger()(loc.reduceRight(function(curr, next) {
			return new SpecificEvent(next, curr);
		}, new EventData(evt)));
	};
}

var run = function(sproc) {
	var node, trigger;
	return sproc
		.process(function(sink) {
			trigger = sink.event.bind(sink);
			// sink.event(new UniversalEvent({ }));
		}, function(change) {
			if(node == null) {
				var cr = change.state;
				var elem = cr.create([], makeCB(function() {
					return trigger;
				}));
				document.body.appendChild(elem);
				node = elem;
			} else {
				/*
					Uncomment this code to enable recreate-every-time mode

					var newNode = (change.state).create([], function(loc, evt) {
						trigger(loc.reduceRight(function(curr, next) {
							return new SpecificEvent({
								path: next,
								data: curr
							});
						}, new EventData(evt)));
					});
					document.body.replaceChild(newNode, node);
					node = newNode;
					return;
				*/

				runCommand(change.diff, node, [], function(loc, evt) {
					trigger(loc.reduceRight(function(curr, next) {
						return new SpecificEvent(next, curr);
					}, new EventData(evt)));
				});
			}
		});
};



function controller(spec) {
	return scanner(function(state, x) {
			return spec[ x[0] ].apply(null, [state].concat(x.slice(1)));
		}, spec.init)
		.compose(fmap(function(val) {
			return new UniversalEvent(val);
		}));
}

function component(ctrl, view) {
	return loop(
			fmap(function(x) {
				return superMatch(x)
					(LoopFeedback, function(x) {
						return new SpecificEvent('feedback', x);
					})
					(LoopIO, function(x) {
						return new SpecificEvent('io', x);
					})
				();
			})
			.compose(simpleEnjoin({
				feedback: ctrl,
				io: fmap(function(x) {
					return x;
				})
			}))
			.compose(
				view()
			)
			.compose(fmap(function(v) {
				if(Bubble.match(v)) {
					return v.data;
				}
				return new LoopIO(v);
			}))
	);
}

function view(fn) {
	return function() {
		return fn(h, fmap, prop, asText);
	};
}

// Removed multi(...) for now

return {
	run: run,
	controller: controller,
	component: component,
	view: view
};

}));

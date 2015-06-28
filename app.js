/* jshint undef: true */
/* globals flumen */

var h = flumen.h,
	ue = flumen.ue;

// This implements TodoMVC. It is based off of Mercury's version.

// To do:
// - localStorage
// - Routing
// - Divide into components
// - Add all features to ul.filters and the following button
// - Fix miscellaneous bugs
// - Improve performance (test against mercury)
// - Simplify code, partly by improving Flumen itself

// Known bugs:
// - After cancelling via escape key, can "un-cancel" by clicking on new-todo <input>

var stateProcessor = flumen.controller({
	init: function() {
		return {
			todos: [],
			text: '',
			counter: 0
		};
	},
	addTodo: function(state, arg1) {
		state.todos.push({
			ID: state.counter,
			Name: state.text,
			completed: false,
			editing: false
		});
		state.counter++;
		return state;
	},
	deleteTodo: function(state, arg1) {
		state.todos = state.todos.filter(function(todo) {
			return todo.ID !== arg1.ID;
		});
		state.counter++;
		return state;
	},
	set: function(state, prop, to) {
		state[prop] = to;
		return state;
	},
	toggleCompleted: function(state, arg1) {
		state.todos = state.todos.map(function(todo) {
			if(todo.ID === arg1.ID) {
				todo.completed = !todo.completed;
			}
			return todo;
		});
		return state;
	},
	startEditing: function(state, arg1) {
		state.todos = state.todos.map(function(todo) {
			if(todo.ID === arg1.ID) {
				todo.editing = true;
				todo.workingText = todo.Name;
			}
			return todo;
		});
		return state;
	},
	changeAll: function(state, to) {
		state.todos = state.todos.map(function(todo) {
			todo.completed = to;
			return todo;
		});
		return state;
	},
	saveChange: function(state, value, todo) {
		state.todos = state.todos.map(function(t) {
			if(t.ID === todo.ID) {
				t.Name = value;
				t.editing = false;
			}
			return t;
		});
		return state;
	},
	cancelChange: function(state, value, todo) {
		state.todos = state.todos.map(function(t) {
			if(t.ID === todo.ID) {
				t.workingText = t.Name;
				t.editing = false;
			}
			return t;
		});
		return state;
	}
});


var html =
h()(
	h('section.todoapp')(
		h('header.header')(
			h('h1')('todos'),
			h('input.new-todo placeholder="What needs to be done?" autofocus=true /', {
				value: flumen.prop('text'),
				oninput: function(e, state, call) {
					call('set', 'text', e.target.value);
				},

				onkeydown: function(e, state, call) {
					if(e.which === 13) {
						e.preventDefault();
						call('addTodo');
					}
				}
			})
		),
		h('section.main')(
			h('input.toggle-all#toggle-all type=checkbox /',{
				onchange: function(e, state, call) {
					call('changeAll', e.target.checked);
				}
			}),
			h('label for=toggle-all')('Mark all as incomplete'),
			h('ul.todo-list').each( flumen.prop('todos'), function() {
				return h('li', {
					class: flumen.fmap(function(v) {
						return (v.completed ? 'completed' : '') + (v.editing ? ' editing' : '');
					})
				})(
					h('div.view')(
						h('input.toggle type=checkbox /', {
							onchange: function(e, state, call) {
								call('toggleCompleted', state);
							},
							checked: flumen.prop('completed')
						}),
						h('label', {
							ondblclick: function(e, state, call) {
								call('startEditing', state);
							}
						})(
							ue(flumen.prop('Name'))
						),
						h('button.destroy /', {
							onclick: function(e, state, call) {
								call('deleteTodo', state);
							}
						})
					),
					h('input.edit /', {
						type: 'text',
						value:  flumen.prop('workingText'),

						// also other events
						onblur: function(e, state, call) {
							call('saveChange', e.target.value, state);
						},

						onkeydown: function(e, state, call) {
							if(e.which === 13) {
								// console.log(state);
								call('saveChange', e.target.value, state);
							} else if(e.which === 27) {
								call('cancelChange', e.target.value, state);
							}
						}

					})
				);
			}, function(v) {
				return v.ID;
			}),
			h('footer', {
				class: flumen.fmap(function(state) {
					// console.log('state', state);
					return (state.todos && state.todos.length) ? 'footer' : 'hidden';
				})
			})(
				h('span.todo-count')(
					h('strong')( ue(flumen.fmap(function(state) {
						var len = state.todos && state.todos.length;
						return len;
					})) ),
					ue( flumen.fmap(function(state) {
						var len = state.todos && state.todos.length;
						return len === 1 ? ' item left' : ' items left';
					}) )
				),
				h('ul.filters /'),
				h('button /')
			)
		)
	),
	h('footer.info')(
		h('p')('Double-click to edit a todo'),
		h('p')('Written by Jason Hansel'),
		h('p')('TodoMVC implementation for Flumen')
	)
);


flumen.runDom( flumen.component(stateProcessor, html) );

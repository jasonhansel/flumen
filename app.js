/* jshint undef: true */
/* globals flumen */

// This implements TodoMVC. It is based off of Mercury's version.

// To do:
// - localStorage
// - Routing
// - Divide into components (started)
// - Add all features to ul.filters and the following button
// - Fix miscellaneous bugs
// - Improve performance (test against mercury)
// - Simplify code, partly by improving Flumen itself

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
	setText: function(state, to) {
		state.text = to;
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
	saveChange: function(state, todo) {
		state.todos = state.todos.map(function(t) {
			if(t.ID === todo.ID) {
				t.Name = t.workingText;
				t.editing = false;
			}
			return t;
		});
		return state;
	},
	setWorkingText: function(state, value, todo) {
		state.todos = state.todos.map(function(t) {
			if(t.ID === todo.ID) {
				t.workingText = value;
			}
			return t;
		});
		return state;
	},
	cancelChange: function(state, todo) {
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

var todoItem = flumen.view(function(h, fmap, prop, asText) {
	return h('li', {
		class: fmap(function(v) { return (v.completed ? 'completed' : '') + (v.editing ? ' editing' : ''); })
	})(
		h('div.view')(
			h('input.toggle type=checkbox /', {
				onchange: function(e, state, call) {
					call('toggleCompleted', state);
				},
				checked: prop('completed')
			}),
			h('label', {
				ondblclick: function(e, state, call) {
					call('startEditing', state);
				}
			})(
				asText(prop('Name'))
			),
			h('button.destroy /', {
				onclick: function(e, state, call) {
					call('deleteTodo', state);
				}
			})
		),
		h('input.edit /', {
			type: 'text',

			// 2 way data binding
			value:  prop('workingText'),
			oninput: function(e, state, call) { call('setWorkingText', e.target.value, state); },


			// Saving/cancelling
			onblur: function(e, state, call) {
				call('saveChange', state);
			},
			onkeydown: function(e, state, call) {
				if(e.which === 13) {
					call('saveChange', state);
				} else if(e.which === 27) {
					call('cancelChange', state);
					// This also triggers saveChange because of the following onblur()
					// however, that causes no problems
				}
			}

		})
	);
});

var html = flumen.view(function(h, fmap, prop, asText) {
	return h()(
		h('section.todoapp')(
			h('header.header')(
				h('h1')('todos'),
				h('input.new-todo placeholder="What needs to be done?" autofocus=true /', {
					value: prop('text'),
					oninput: function(e, state, call) {
						call('setText', e.target.value);
					},

					onkeydown: function(e, state, call) {
						if(e.which === 13) {
							e.preventDefault();
							call('addTodo');
							call('setText', '');
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
				h('ul.todo-list').each(
					prop('todos'),
					todoItem,
					function(v) { return v.ID; }
				),
				h('footer', {
					class: fmap(function(state) { return state.todos.length ? 'footer' : 'hidden'; })
				})(
					h('span.todo-count')(
						h('strong')(
							asText(fmap(function(state) { return state.todos.length; }))
						),
						asText(fmap(function(state) { return state.todos.length === 1 ? ' item left' : ' items left'; }))
					),
					h('ul.filters')(
						h('li')(h('a.selected')( 'All' )),
						h('li')(h('a')( 'Active' )),
						h('li')(h('a')( 'Completed' ))
					),
					h('button.clear-completed')(
						'Clear completed'
					)
				)
			)
		),
		h('footer.info')(
			h('p')('Double-click to edit a todo'),
			h('p')('Written by Jason Hansel'),
			h('p')('TodoMVC implementation for Flumen')
		)
	);
});


flumen.run( flumen.component(stateProcessor, html) );

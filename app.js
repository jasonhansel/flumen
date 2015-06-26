/* jshint undef: true */
/* globals flumen */

var h = flumen.h,
	ue = flumen.ue;


// To do: localStorage, routing, divide into components, other things listed below

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
		// state.text = '';
		return state;
	},
	deleteTodo: function(state, arg1) {
		console.log('DODEL', arg1);
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
		console.log('DOSAVE');

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
		console.log('DOSAVE');

		state.todos = state.todos.map(function(t) {
			if(t.ID === todo.ID) {
				// t.Name = value;
				t.workingText = t.Name;
				t.editing = false;
				// console.log('PROD', t);
			}
			return t;
		});
		return state;
	},
	nil: function(state) {
		return state;
	}
});


var html =
h()(
	h('section.todoapp')(
		h('header.header')(
			h('h1')('todos'),
			h('input.new-todo placeholder="What needs to be done?" autofocus=true /', {
				value: flumen.fmap(function(state) {
					return state ? state.text : '';
				}),
				oninput: function(e, state, ccall) {
					ccall('set', 'text', e.target.value);
				},

				onkeydown: function(e, state, ccall) {
					if(e.which === 13) {
						e.preventDefault();
						ccall('addTodo');
					}
				}
			})
		),
		h('section.main')(
			h('input.toggle-all#toggle-all type=checkbox /',{
				onchange: function(e, state, ccall) {
					ccall('changeAll', e.target.checked);
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
							onchange: function(e, state, ccall) {
								ccall('toggleCompleted', state);
							},
							checked: flumen.prop('completed')
						}),
						h('label', {
							ondblclick: function(e, state, ccall) {
								ccall('startEditing', state);
							}
						})(
							ue(flumen.prop('Name'))
						),
						h('button.destroy /', {
							onclick: function(e, state, ccall) {
								ccall('deleteTodo', state);
							}
						})
					),
					h('input.edit /', {
						type: 'text',
						value:  flumen.fmap(function(state) {
							return state ? state.workingText : '';
						}),

						// also other events
						onblur: function(e, state, ccall) {
							ccall('saveChange', e.target.value, state);
						},

						onkeydown: function(e, state, ccall) {
							if(e.which === 13) {
								ccall('saveChange', e.target.value, state);
							} else if(e.which === 27) {
								ccall('cancelChange', e.target.value, state);
							}
						}

					})
				);
			}, function(v) {
				return v.ID;
			}),
			h('footer', {
				class: flumen.fmap(function(state) {
					return (state && state.todos && state.todos.length) ? 'footer' : 'hidden';
				})
			})(
				h('span.todo-count')(
					h('strong')( ue(flumen.fmap(function(state) {
						var len = state && state.todos && state.todos.length;
						return len;
					})) ),
					ue( flumen.fmap(function(state) {
						var len = state && state.todos && state.todos.length;
						return len === 1 ? ' item left' : ' items left';
					}) )
				),
				h('ul.filters')(),
				h('button')()
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

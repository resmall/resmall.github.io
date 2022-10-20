
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.50.1' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/templates/deploy.svelte generated by Svelte v3.50.1 */

    const file$3 = "src/templates/deploy.svelte";

    function create_fragment$3(ctx) {
    	let textarea;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			textarea = element("textarea");
    			textarea.readOnly = true;
    			attr_dev(textarea, "class", "svelte-wdqgg");
    			add_location(textarea, file$3, 27, 0, 542);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, textarea, anchor);
    			set_input_value(textarea, /*template*/ ctx[0]);

    			if (!mounted) {
    				dispose = listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[3]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*template*/ 1) {
    				set_input_value(textarea, /*template*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(textarea);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let template;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Deploy', slots, []);
    	let { tableName } = $$props;
    	let { createCode } = $$props;
    	const writable_props = ['tableName', 'createCode'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Deploy> was created with unknown prop '${key}'`);
    	});

    	function textarea_input_handler() {
    		template = this.value;
    		(($$invalidate(0, template), $$invalidate(1, tableName)), $$invalidate(2, createCode));
    	}

    	$$self.$$set = $$props => {
    		if ('tableName' in $$props) $$invalidate(1, tableName = $$props.tableName);
    		if ('createCode' in $$props) $$invalidate(2, createCode = $$props.createCode);
    	};

    	$$self.$capture_state = () => ({ tableName, createCode, template });

    	$$self.$inject_state = $$props => {
    		if ('tableName' in $$props) $$invalidate(1, tableName = $$props.tableName);
    		if ('createCode' in $$props) $$invalidate(2, createCode = $$props.createCode);
    		if ('template' in $$props) $$invalidate(0, template = $$props.template);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*tableName, createCode*/ 6) {
    			$$invalidate(0, template = `
DO $$
BEGIN

SET ROLE docday_deploy_role;
SET SCHEMA 'public';

IF EXISTS (SELECT FROM pg_catalog.pg_tables WHERE  schemaname = 'public' AND tablename = '${tableName}') THEN
    RAISE NOTICE 'Table public.${tableName} already exists.';
ELSE
    RAISE NOTICE 'Creating table public.${tableName}.';
    CREATE TABLE public.${tableName} (
       ${createCode}
    );


    GRANT ALL ON TABLE public.${tableName} TO readonly_role;
END IF;

COMMIT;
END $$;
`);
    		}
    	};

    	return [template, tableName, createCode, textarea_input_handler];
    }

    class Deploy extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { tableName: 1, createCode: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Deploy",
    			options,
    			id: create_fragment$3.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*tableName*/ ctx[1] === undefined && !('tableName' in props)) {
    			console.warn("<Deploy> was created without expected prop 'tableName'");
    		}

    		if (/*createCode*/ ctx[2] === undefined && !('createCode' in props)) {
    			console.warn("<Deploy> was created without expected prop 'createCode'");
    		}
    	}

    	get tableName() {
    		throw new Error("<Deploy>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set tableName(value) {
    		throw new Error("<Deploy>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get createCode() {
    		throw new Error("<Deploy>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set createCode(value) {
    		throw new Error("<Deploy>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/templates/revert.svelte generated by Svelte v3.50.1 */

    const file$2 = "src/templates/revert.svelte";

    function create_fragment$2(ctx) {
    	let textarea;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			textarea = element("textarea");
    			attr_dev(textarea, "width", "200");
    			attr_dev(textarea, "height", "20");
    			textarea.readOnly = true;
    			attr_dev(textarea, "class", "svelte-1uyzydi");
    			add_location(textarea, file$2, 9, 0, 130);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, textarea, anchor);
    			set_input_value(textarea, /*template*/ ctx[0]);

    			if (!mounted) {
    				dispose = listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[2]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*template*/ 1) {
    				set_input_value(textarea, /*template*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(textarea);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let template;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Revert', slots, []);
    	let { tableName } = $$props;
    	const writable_props = ['tableName'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Revert> was created with unknown prop '${key}'`);
    	});

    	function textarea_input_handler() {
    		template = this.value;
    		($$invalidate(0, template), $$invalidate(1, tableName));
    	}

    	$$self.$$set = $$props => {
    		if ('tableName' in $$props) $$invalidate(1, tableName = $$props.tableName);
    	};

    	$$self.$capture_state = () => ({ tableName, template });

    	$$self.$inject_state = $$props => {
    		if ('tableName' in $$props) $$invalidate(1, tableName = $$props.tableName);
    		if ('template' in $$props) $$invalidate(0, template = $$props.template);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*tableName*/ 2) {
    			$$invalidate(0, template = `
  BEGIN;
  DROP TABLE IF EXISTS public.${tableName};
  COMMIT;
  `);
    		}
    	};

    	return [template, tableName, textarea_input_handler];
    }

    class Revert extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { tableName: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Revert",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*tableName*/ ctx[1] === undefined && !('tableName' in props)) {
    			console.warn("<Revert> was created without expected prop 'tableName'");
    		}
    	}

    	get tableName() {
    		throw new Error("<Revert>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set tableName(value) {
    		throw new Error("<Revert>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/templates/verify.svelte generated by Svelte v3.50.1 */

    const file$1 = "src/templates/verify.svelte";

    function create_fragment$1(ctx) {
    	let textarea;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			textarea = element("textarea");
    			textarea.readOnly = true;
    			attr_dev(textarea, "class", "svelte-1g6mjhi");
    			add_location(textarea, file$1, 17, 0, 303);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, textarea, anchor);
    			set_input_value(textarea, /*template*/ ctx[0]);

    			if (!mounted) {
    				dispose = listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[2]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*template*/ 1) {
    				set_input_value(textarea, /*template*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(textarea);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let template;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Verify', slots, []);
    	let { tableName } = $$props;
    	const writable_props = ['tableName'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Verify> was created with unknown prop '${key}'`);
    	});

    	function textarea_input_handler() {
    		template = this.value;
    		($$invalidate(0, template), $$invalidate(1, tableName));
    	}

    	$$self.$$set = $$props => {
    		if ('tableName' in $$props) $$invalidate(1, tableName = $$props.tableName);
    	};

    	$$self.$capture_state = () => ({ tableName, template });

    	$$self.$inject_state = $$props => {
    		if ('tableName' in $$props) $$invalidate(1, tableName = $$props.tableName);
    		if ('template' in $$props) $$invalidate(0, template = $$props.template);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*tableName*/ 2) {
    			$$invalidate(0, template = `
BEGIN;

DO $$
DECLARE
    result boolean;
BEGIN
   result := (SELECT EXISTS(SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '${tableName}' AND TABLE_SCHEMA = 'public'));
   ASSERT result = true;
END $$;

ROLLBACK;
    `);
    		}
    	};

    	return [template, tableName, textarea_input_handler];
    }

    class Verify extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { tableName: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Verify",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*tableName*/ ctx[1] === undefined && !('tableName' in props)) {
    			console.warn("<Verify> was created without expected prop 'tableName'");
    		}
    	}

    	get tableName() {
    		throw new Error("<Verify>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set tableName(value) {
    		throw new Error("<Verify>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.50.1 */
    const file = "src/App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let h30;
    	let t1;
    	let input;
    	let t2;
    	let h31;
    	let t4;
    	let textarea;
    	let t5;
    	let h32;
    	let t7;
    	let revert;
    	let t8;
    	let h33;
    	let t10;
    	let verify;
    	let t11;
    	let h34;
    	let t13;
    	let deploy;
    	let current;
    	let mounted;
    	let dispose;

    	revert = new Revert({
    			props: { tableName: /*tableName*/ ctx[0] },
    			$$inline: true
    		});

    	verify = new Verify({
    			props: { tableName: /*tableName*/ ctx[0] },
    			$$inline: true
    		});

    	deploy = new Deploy({
    			props: {
    				tableName: /*tableName*/ ctx[0],
    				createCode: /*createCode*/ ctx[1]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			main = element("main");
    			h30 = element("h3");
    			h30.textContent = "TableName";
    			t1 = space();
    			input = element("input");
    			t2 = space();
    			h31 = element("h3");
    			h31.textContent = "Insert the columns to be added here.";
    			t4 = space();
    			textarea = element("textarea");
    			t5 = space();
    			h32 = element("h3");
    			h32.textContent = "Revert";
    			t7 = space();
    			create_component(revert.$$.fragment);
    			t8 = space();
    			h33 = element("h3");
    			h33.textContent = "Verify";
    			t10 = space();
    			create_component(verify.$$.fragment);
    			t11 = space();
    			h34 = element("h3");
    			h34.textContent = "Deploy code output";
    			t13 = space();
    			create_component(deploy.$$.fragment);
    			add_location(h30, file, 10, 2, 333);
    			attr_dev(input, "type", "text");
    			attr_dev(input, "id", "");
    			add_location(input, file, 11, 2, 354);
    			add_location(h31, file, 13, 2, 408);
    			attr_dev(textarea, "id", "deploy");
    			attr_dev(textarea, "class", "svelte-isv1j");
    			add_location(textarea, file, 14, 2, 456);
    			add_location(h32, file, 16, 2, 508);
    			add_location(h33, file, 19, 2, 552);
    			add_location(h34, file, 22, 2, 596);
    			attr_dev(main, "class", "svelte-isv1j");
    			add_location(main, file, 9, 0, 324);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h30);
    			append_dev(main, t1);
    			append_dev(main, input);
    			set_input_value(input, /*tableName*/ ctx[0]);
    			append_dev(main, t2);
    			append_dev(main, h31);
    			append_dev(main, t4);
    			append_dev(main, textarea);
    			set_input_value(textarea, /*createCode*/ ctx[1]);
    			append_dev(main, t5);
    			append_dev(main, h32);
    			append_dev(main, t7);
    			mount_component(revert, main, null);
    			append_dev(main, t8);
    			append_dev(main, h33);
    			append_dev(main, t10);
    			mount_component(verify, main, null);
    			append_dev(main, t11);
    			append_dev(main, h34);
    			append_dev(main, t13);
    			mount_component(deploy, main, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[2]),
    					listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[3])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*tableName*/ 1 && input.value !== /*tableName*/ ctx[0]) {
    				set_input_value(input, /*tableName*/ ctx[0]);
    			}

    			if (dirty & /*createCode*/ 2) {
    				set_input_value(textarea, /*createCode*/ ctx[1]);
    			}

    			const revert_changes = {};
    			if (dirty & /*tableName*/ 1) revert_changes.tableName = /*tableName*/ ctx[0];
    			revert.$set(revert_changes);
    			const verify_changes = {};
    			if (dirty & /*tableName*/ 1) verify_changes.tableName = /*tableName*/ ctx[0];
    			verify.$set(verify_changes);
    			const deploy_changes = {};
    			if (dirty & /*tableName*/ 1) deploy_changes.tableName = /*tableName*/ ctx[0];
    			if (dirty & /*createCode*/ 2) deploy_changes.createCode = /*createCode*/ ctx[1];
    			deploy.$set(deploy_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(revert.$$.fragment, local);
    			transition_in(verify.$$.fragment, local);
    			transition_in(deploy.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(revert.$$.fragment, local);
    			transition_out(verify.$$.fragment, local);
    			transition_out(deploy.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(revert);
    			destroy_component(verify);
    			destroy_component(deploy);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let { tableName } = $$props;
    	let { createCode } = $$props;
    	const writable_props = ['tableName', 'createCode'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		tableName = this.value;
    		$$invalidate(0, tableName);
    	}

    	function textarea_input_handler() {
    		createCode = this.value;
    		$$invalidate(1, createCode);
    	}

    	$$self.$$set = $$props => {
    		if ('tableName' in $$props) $$invalidate(0, tableName = $$props.tableName);
    		if ('createCode' in $$props) $$invalidate(1, createCode = $$props.createCode);
    	};

    	$$self.$capture_state = () => ({
    		Deploy,
    		Revert,
    		Verify,
    		tableName,
    		createCode
    	});

    	$$self.$inject_state = $$props => {
    		if ('tableName' in $$props) $$invalidate(0, tableName = $$props.tableName);
    		if ('createCode' in $$props) $$invalidate(1, createCode = $$props.createCode);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [tableName, createCode, input_input_handler, textarea_input_handler];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { tableName: 0, createCode: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*tableName*/ ctx[0] === undefined && !('tableName' in props)) {
    			console.warn("<App> was created without expected prop 'tableName'");
    		}

    		if (/*createCode*/ ctx[1] === undefined && !('createCode' in props)) {
    			console.warn("<App> was created without expected prop 'createCode'");
    		}
    	}

    	get tableName() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set tableName(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get createCode() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set createCode(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const app = new App({
        target: document.body,
        props: {
            name: 'world'
        }
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map

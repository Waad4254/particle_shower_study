(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.TweakpaneFileImportPlugin = {}));
})(this, (function (exports) { 'use strict';

    function forceCast(v) {
        return v;
    }

    const PREFIX = 'tp';
    function ClassName(viewName) {
        const fn = (opt_elementName, opt_modifier) => {
            return [
                PREFIX,
                '-',
                viewName,
                'v',
                opt_elementName ? `_${opt_elementName}` : '',
                opt_modifier ? `-${opt_modifier}` : '',
            ].join('');
        };
        return fn;
    }

    function parseObject(value, keyToParserMap) {
        const keys = Object.keys(keyToParserMap);
        const result = keys.reduce((tmp, key) => {
            if (tmp === undefined) {
                return undefined;
            }
            const parser = keyToParserMap[key];
            const result = parser(value[key]);
            return result.succeeded
                ? Object.assign(Object.assign({}, tmp), { [key]: result.value }) : undefined;
        }, {});
        return forceCast(result);
    }
    function parseArray(value, parseItem) {
        return value.reduce((tmp, item) => {
            if (tmp === undefined) {
                return undefined;
            }
            const result = parseItem(item);
            if (!result.succeeded || result.value === undefined) {
                return undefined;
            }
            return [...tmp, result.value];
        }, []);
    }
    function isObject(value) {
        if (value === null) {
            return false;
        }
        return typeof value === 'object';
    }
    function createParamsParserBuilder(parse) {
        return (optional) => (v) => {
            if (!optional && v === undefined) {
                return {
                    succeeded: false,
                    value: undefined,
                };
            }
            if (optional && v === undefined) {
                return {
                    succeeded: true,
                    value: undefined,
                };
            }
            const result = parse(v);
            return result !== undefined
                ? {
                    succeeded: true,
                    value: result,
                }
                : {
                    succeeded: false,
                    value: undefined,
                };
        };
    }
    function createParamsParserBuilders(optional) {
        return {
            custom: (parse) => createParamsParserBuilder(parse)(optional),
            boolean: createParamsParserBuilder((v) => typeof v === 'boolean' ? v : undefined)(optional),
            number: createParamsParserBuilder((v) => typeof v === 'number' ? v : undefined)(optional),
            string: createParamsParserBuilder((v) => typeof v === 'string' ? v : undefined)(optional),
            function: createParamsParserBuilder((v) =>
            typeof v === 'function' ? v : undefined)(optional),
            constant: (value) => createParamsParserBuilder((v) => (v === value ? value : undefined))(optional),
            raw: createParamsParserBuilder((v) => v)(optional),
            object: (keyToParserMap) => createParamsParserBuilder((v) => {
                if (!isObject(v)) {
                    return undefined;
                }
                return parseObject(v, keyToParserMap);
            })(optional),
            array: (itemParser) => createParamsParserBuilder((v) => {
                if (!Array.isArray(v)) {
                    return undefined;
                }
                return parseArray(v, itemParser);
            })(optional),
        };
    }
    const ParamsParsers = {
        optional: createParamsParserBuilders(true),
        required: createParamsParserBuilders(false),
    };
    function parseParams(value, keyToParserMap) {
        const result = ParamsParsers.required.object(keyToParserMap)(value);
        return result.succeeded ? result.value : undefined;
    }

    class CompositeConstraint {
        constructor(constraints) {
            this.constraints = constraints;
        }
        constrain(value) {
            return this.constraints.reduce((result, c) => {
                return c.constrain(result);
            }, value);
        }
    }

    function createNumberFormatter(digits) {
        return (value) => {
            return value.toFixed(Math.max(Math.min(digits, 20), 0));
        };
    }

    const innerFormatter = createNumberFormatter(0);
    function formatPercentage(value) {
        return innerFormatter(value) + '%';
    }

    function constrainRange(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function removeAlphaComponent(comps) {
        return [comps[0], comps[1], comps[2]];
    }

    function zerofill(comp) {
        const hex = constrainRange(Math.floor(comp), 0, 255).toString(16);
        return hex.length === 1 ? `0${hex}` : hex;
    }
    function colorToHexRgbString(value, prefix = '#') {
        const hexes = removeAlphaComponent(value.getComponents('rgb'))
            .map(zerofill)
            .join('');
        return `${prefix}${hexes}`;
    }
    function colorToHexRgbaString(value, prefix = '#') {
        const rgbaComps = value.getComponents('rgb');
        const hexes = [rgbaComps[0], rgbaComps[1], rgbaComps[2], rgbaComps[3] * 255]
            .map(zerofill)
            .join('');
        return `${prefix}${hexes}`;
    }
    function colorToFunctionalRgbString(value, opt_type) {
        const formatter = createNumberFormatter(opt_type === 'float' ? 2 : 0);
        const comps = removeAlphaComponent(value.getComponents('rgb', opt_type)).map((comp) => formatter(comp));
        return `rgb(${comps.join(', ')})`;
    }
    function createFunctionalRgbColorFormatter(type) {
        return (value) => {
            return colorToFunctionalRgbString(value, type);
        };
    }
    function colorToFunctionalRgbaString(value, opt_type) {
        const aFormatter = createNumberFormatter(2);
        const rgbFormatter = createNumberFormatter(opt_type === 'float' ? 2 : 0);
        const comps = value.getComponents('rgb', opt_type).map((comp, index) => {
            const formatter = index === 3 ? aFormatter : rgbFormatter;
            return formatter(comp);
        });
        return `rgba(${comps.join(', ')})`;
    }
    function createFunctionalRgbaColorFormatter(type) {
        return (value) => {
            return colorToFunctionalRgbaString(value, type);
        };
    }
    function colorToFunctionalHslString(value) {
        const formatters = [
            createNumberFormatter(0),
            formatPercentage,
            formatPercentage,
        ];
        const comps = removeAlphaComponent(value.getComponents('hsl')).map((comp, index) => formatters[index](comp));
        return `hsl(${comps.join(', ')})`;
    }
    function colorToFunctionalHslaString(value) {
        const formatters = [
            createNumberFormatter(0),
            formatPercentage,
            formatPercentage,
            createNumberFormatter(2),
        ];
        const comps = value
            .getComponents('hsl')
            .map((comp, index) => formatters[index](comp));
        return `hsla(${comps.join(', ')})`;
    }
    function colorToObjectRgbString(value, type) {
        const formatter = createNumberFormatter(type === 'float' ? 2 : 0);
        const names = ['r', 'g', 'b'];
        const comps = removeAlphaComponent(value.getComponents('rgb', type)).map((comp, index) => `${names[index]}: ${formatter(comp)}`);
        return `{${comps.join(', ')}}`;
    }
    function createObjectRgbColorFormatter(type) {
        return (value) => colorToObjectRgbString(value, type);
    }
    function colorToObjectRgbaString(value, type) {
        const aFormatter = createNumberFormatter(2);
        const rgbFormatter = createNumberFormatter(type === 'float' ? 2 : 0);
        const names = ['r', 'g', 'b', 'a'];
        const comps = value.getComponents('rgb', type).map((comp, index) => {
            const formatter = index === 3 ? aFormatter : rgbFormatter;
            return `${names[index]}: ${formatter(comp)}`;
        });
        return `{${comps.join(', ')}}`;
    }
    function createObjectRgbaColorFormatter(type) {
        return (value) => colorToObjectRgbaString(value, type);
    }
    [
        {
            format: {
                alpha: false,
                mode: 'rgb',
                notation: 'hex',
                type: 'int',
            },
            stringifier: colorToHexRgbString,
        },
        {
            format: {
                alpha: true,
                mode: 'rgb',
                notation: 'hex',
                type: 'int',
            },
            stringifier: colorToHexRgbaString,
        },
        {
            format: {
                alpha: false,
                mode: 'hsl',
                notation: 'func',
                type: 'int',
            },
            stringifier: colorToFunctionalHslString,
        },
        {
            format: {
                alpha: true,
                mode: 'hsl',
                notation: 'func',
                type: 'int',
            },
            stringifier: colorToFunctionalHslaString,
        },
        ...['int', 'float'].reduce((prev, type) => {
            return [
                ...prev,
                {
                    format: {
                        alpha: false,
                        mode: 'rgb',
                        notation: 'func',
                        type: type,
                    },
                    stringifier: createFunctionalRgbColorFormatter(type),
                },
                {
                    format: {
                        alpha: true,
                        mode: 'rgb',
                        notation: 'func',
                        type: type,
                    },
                    stringifier: createFunctionalRgbaColorFormatter(type),
                },
                {
                    format: {
                        alpha: false,
                        mode: 'rgb',
                        notation: 'object',
                        type: type,
                    },
                    stringifier: createObjectRgbColorFormatter(type),
                },
                {
                    format: {
                        alpha: true,
                        mode: 'rgb',
                        notation: 'object',
                        type: type,
                    },
                    stringifier: createObjectRgbaColorFormatter(type),
                },
            ];
        }, []),
    ];

    // Create a class name generator from the view name
    // ClassName('tmp') will generate a CSS class name like `tp-tmpv`
    const containerClassName = ClassName('ctn');
    const inputClassName = ClassName('input');
    const deleteButtonClassName = ClassName('btn');
    class FilePluginView {
        constructor(doc, config) {
            // Root
            this.element = doc.createElement('div');
            // Container
            this.container = doc.createElement('div');
            this.container.classList.add(containerClassName());
            config.viewProps.bindClassModifiers(this.container);
            // File input field
            this.input = doc.createElement('input');
            this.input.classList.add(inputClassName());
            this.input.setAttribute('type', 'file');
            this.input.setAttribute('accept', config.filetypes ? config.filetypes.join(',') : '*');
            this.input.style.height = `calc(20px * ${config.lineCount})`;
            // Icon
            this.fileIcon = doc.createElement('div');
            this.fileIcon.classList.add(containerClassName('icon'));
            // Text
            this.text = doc.createElement('span');
            this.text.classList.add(containerClassName('text'));
            // Warning text
            this.warning = doc.createElement('span');
            this.warning.classList.add(containerClassName('warning'));
            this.warning.innerHTML = config.invalidFiletypeMessage;
            this.warning.style.display = 'none';
            // Delete button
            this.deleteButton = doc.createElement('button');
            this.deleteButton.classList.add(deleteButtonClassName('b'));
            this.deleteButton.innerHTML = 'Delete';
            this.deleteButton.style.display = 'none';
            this.container.appendChild(this.input);
            this.container.appendChild(this.fileIcon);
            this.element.appendChild(this.container);
            this.element.appendChild(this.warning);
            this.element.appendChild(this.deleteButton);
        }
        /**
         * Changes the style of the container based on whether the user is dragging or not.
         * @param state if the user is dragging or not.
         */
        changeDraggingState(state) {
            var _a, _b;
            if (state) {
                (_a = this.container) === null || _a === void 0 ? void 0 : _a.classList.add(containerClassName('input_area_dragging'));
            }
            else {
                (_b = this.container) === null || _b === void 0 ? void 0 : _b.classList.remove(containerClassName('input_area_dragging'));
            }
        }
    }

    class FilePluginController {
        constructor(doc, config) {
            this.value = config.value;
            this.viewProps = config.viewProps;
            this.view = new FilePluginView(doc, {
                viewProps: this.viewProps,
                value: config.value,
                invalidFiletypeMessage: config.invalidFiletypeMessage,
                lineCount: config.lineCount,
                filetypes: config.filetypes,
            });
            this.config = config;
            // Bind event handlers
            this.onFile = this.onFile.bind(this);
            this.onDrop = this.onDrop.bind(this);
            this.onDragOver = this.onDragOver.bind(this);
            this.onDragLeave = this.onDragLeave.bind(this);
            this.onDeleteClick = this.onDeleteClick.bind(this);
            this.view.input.addEventListener('change', this.onFile);
            this.view.element.addEventListener('drop', this.onDrop);
            this.view.element.addEventListener('dragover', this.onDragOver);
            this.view.element.addEventListener('dragleave', this.onDragLeave);
            this.view.deleteButton.addEventListener('click', this.onDeleteClick);
            this.value.emitter.on('change', () => this.handleValueChange());
            // Dispose event handlers
            this.viewProps.handleDispose(() => {
                this.view.input.removeEventListener('change', this.onFile);
                this.view.element.removeEventListener('drop', this.onDrop);
                this.view.element.removeEventListener('dragover', this.onDragOver);
                this.view.element.removeEventListener('dragleave', this.onDragLeave);
                this.view.deleteButton.removeEventListener('click', this.onDeleteClick);
            });
        }
        /**
         * Called when the value of the input changes.
         * @param event change event.
         */
        onFile(_event) {
            const input = this.view.input;
            // Check if user has chosen a file.
            // If it's valid, we update the value. Otherwise, show warning.
            if (input.files && input.files.length > 0) {
                const file = input.files[0];
                if (!this.isFileValid(file)) {
                    this.showWarning();
                }
                else {
                    this.value.setRawValue(file);
                }
            }
        }
        /**
         * Shows warning text for 5 seconds.
         */
        showWarning() {
            this.view.warning.style.display = 'block';
            setTimeout(() => {
                // Resetting warning text
                this.view.warning.style.display = 'none';
            }, 5000);
        }
        /**
         * Checks if the file is valid with the given filetypes.
         * @param file File object
         * @returns true if the file is valid.
         */
        isFileValid(file) {
            var _a;
            const filetypes = this.config.filetypes;
            const fileExtension = '.' + ((_a = file.name.split('.').pop()) === null || _a === void 0 ? void 0 : _a.toLowerCase());
            return !(filetypes &&
                filetypes.length > 0 &&
                !filetypes.includes(fileExtension) &&
                fileExtension);
        }
        /**
         * Event handler when the delete HTML button is clicked.
         * It resets the `rawValue` of the controller.
         */
        onDeleteClick() {
            const file = this.value.rawValue;
            if (file) {
                // Resetting the value
                this.value.setRawValue(null);
                // Resetting the input
                this.view.input.value = '';
                // Resetting the warning text
                this.view.warning.innerHTML = '';
                this.view.warning.style.display = 'none';
            }
        }
        /**
         * Called when the user drags over a file.
         * Updates the style of the container.
         * @param event drag event.
         */
        onDragOver(event) {
            event.preventDefault();
            this.view.changeDraggingState(true);
        }
        /**
         * Called when the user leaves the container while dragging.
         * Updates the style of the container.
         */
        onDragLeave() {
            this.view.changeDraggingState(false);
        }
        /**
         * Called when the user drops a file in the container.
         * Either shows a warning if it's invalid or updates the value if it's valid.
         * @param ev drag event.
         */
        onDrop(ev) {
            if (ev instanceof DragEvent) {
                // Prevent default behavior (Prevent file from being opened)
                ev.preventDefault();
                if (ev.dataTransfer) {
                    if (ev.dataTransfer.files) {
                        // We only change the value if the user has dropped a single file
                        const filesArray = [ev.dataTransfer.files][0];
                        if (filesArray.length == 1) {
                            const file = filesArray.item(0);
                            if (file) {
                                if (!this.isFileValid(file)) {
                                    this.showWarning();
                                }
                                else {
                                    this.value.setRawValue(file);
                                }
                            }
                        }
                    }
                }
            }
            this.view.changeDraggingState(false);
        }
        /**
         * Called when the value (bound to the controller) changes (e.g. when the file is selected).
         */
        handleValueChange() {
            const fileObj = this.value.rawValue;
            const containerEl = this.view.container;
            const textEl = this.view.text;
            const fileIconEl = this.view.fileIcon;
            const deleteButton = this.view.deleteButton;
            if (fileObj) {
                // Setting the text of the file to the element
                textEl.textContent = fileObj.name;
                // Removing icon and adding text
                containerEl.appendChild(textEl);
                if (containerEl.contains(fileIconEl)) {
                    containerEl.removeChild(fileIconEl);
                }
                // Resetting warning text
                this.view.warning.innerHTML = '';
                this.view.warning.style.display = 'none';
                // Adding button to delete
                deleteButton.style.display = 'block';
                containerEl.style.border = 'unset';
            }
            else {
                // Setting the text of the file to the element
                textEl.textContent = '';
                // Removing text and adding icon
                containerEl.appendChild(fileIconEl);
                containerEl.removeChild(textEl);
                // Resetting warning text
                this.view.warning.innerHTML = '';
                this.view.warning.style.display = 'none';
                // Hiding button and resetting border
                deleteButton.style.display = 'none';
                containerEl.style.border = '1px dashed #717070';
            }
        }
    }

    const TweakpaneFileInputPlugin = {
        id: 'file-input',
        // type: The plugin type.
        type: 'input',
        // This plugin template injects a compiled CSS by @rollup/plugin-replace
        // See rollup.config.js for details
        css: '.tp-ctnv{-webkit-appearance:none;-moz-appearance:none;appearance:none;background-color:rgba(0,0,0,0);border-width:0;font-family:inherit;font-size:inherit;font-weight:inherit;margin:0;outline:none;padding:0}.tp-ctnv{background-color:var(--in-bg);border-radius:var(--elm-br);box-sizing:border-box;color:var(--in-fg);font-family:inherit;height:var(--bld-us);line-height:var(--bld-us);min-width:0;width:100%}.tp-ctnv:hover{background-color:var(--in-bg-h)}.tp-ctnv:focus{background-color:var(--in-bg-f)}.tp-ctnv:active{background-color:var(--in-bg-a)}.tp-ctnv:disabled{opacity:.5}.tp-ctnv{cursor:pointer;display:flex;justify-content:center;align-items:center;overflow:hidden;position:relative;height:100%;width:100%;border:1px dashed #717070;border-radius:5px}.tp-ctnv.tp-v-disabled{opacity:.5}.tp-ctnv_input_area_dragging{border:1px dashed #6774ff;background-color:rgba(88,88,185,.231372549)}.tp-ctnv_warning{color:var(--in-fg);bottom:2px;display:inline-block;font-size:.9em;height:-moz-max-content;height:max-content;line-height:1.5;margin:.2rem;opacity:.5;white-space:normal;width:-moz-max-content;width:max-content;word-wrap:break-word;text-align:right;width:100%;margin-top:var(--cnt-h-p)}.tp-ctnv_text{color:var(--in-fg);bottom:2px;display:inline-block;font-size:.9em;height:-moz-max-content;height:max-content;line-height:.9;margin:.2rem;max-height:100%;max-width:100%;opacity:.5;position:absolute;right:2px;text-align:right;white-space:normal;width:-moz-max-content;width:max-content;word-wrap:break-word}.tp-ctnv_frac{background-color:var(--in-fg);border-radius:1px;height:2px;left:50%;margin-top:-1px;position:absolute;top:50%}.tp-ctnv_icon{box-sizing:border-box;position:absolute;display:block;transform:scale(var(--ggs, 1));width:16px;height:6px;border:2px solid;border-top:0;border-bottom-left-radius:2px;border-bottom-right-radius:2px;margin-top:8px;opacity:.5}.tp-ctnv_icon::after{content:"";display:block;box-sizing:border-box;position:absolute;width:8px;height:8px;border-left:2px solid;border-top:2px solid;transform:rotate(45deg);left:2px;bottom:4px}.tp-ctnv_icon::before{content:"";display:block;box-sizing:border-box;position:absolute;border-radius:3px;width:2px;height:10px;background:currentColor;left:5px;bottom:3px}.tp-btnv_b{margin-top:10px}.tp-inputv{opacity:0}',
        accept(exValue, params) {
            if (typeof exValue !== 'string') {
                // Return null to deny the user input
                return null;
            }
            // Parse parameters object
            const p = ParamsParsers;
            const result = parseParams(params, {
                // `view` option may be useful to provide a custom control for primitive values
                view: p.required.constant('file-input'),
                invalidFiletypeMessage: p.optional.string,
                lineCount: p.optional.number,
                filetypes: p.optional.array(p.required.string),
            });
            if (!result) {
                return null;
            }
            // Return a typed value and params to accept the user input
            return {
                initialValue: exValue,
                params: result,
            };
        },
        binding: {
            reader(_args) {
                return (exValue) => {
                    // Convert an external unknown value into the internal value
                    return exValue instanceof File ? exValue : null;
                };
            },
            constraint(_args) {
                return new CompositeConstraint([]);
            },
            writer(_args) {
                return (target, inValue) => {
                    // Use `target.write()` to write the primitive value to the target,
                    // or `target.writeProperty()` to write a property of the target
                    target.write(inValue);
                };
            },
        },
        controller(args) {
            var _a, _b;
            const defaultNumberOfLines = 3;
            const defaultFiletypeWarningText = 'Unaccepted file type.';
            // Create a controller for the plugin
            return new FilePluginController(args.document, {
                value: args.value,
                viewProps: args.viewProps,
                invalidFiletypeMessage: (_a = args.params.invalidFiletypeMessage) !== null && _a !== void 0 ? _a : defaultFiletypeWarningText,
                lineCount: (_b = args.params.lineCount) !== null && _b !== void 0 ? _b : defaultNumberOfLines,
                filetypes: args.params.filetypes,
            });
        },
    };

    // Export your plugin(s) as constant `plugins`
    const plugins = [TweakpaneFileInputPlugin];

    exports.plugins = plugins;

    Object.defineProperty(exports, '__esModule', { value: true });

}));

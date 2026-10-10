const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

describe('Mobile Native Keyboard & Accessory Toolbar', function () {
    let window, document;
    let fTelnetOptions, fTelnetClient, MobileKeyboard, Crt, KeyboardKeys;

    before(function () {
        const bundlePath = path.resolve(__dirname, '../release/ftelnet.norip.noxfer.js');
        const code = fs.readFileSync(bundlePath, 'utf8');

        const dom = new JSDOM(`<!DOCTYPE html>
<html>
<head></head>
<body>
    <div id="fTelnetContainer"></div>
    <script id="fTelnetScript"></script>
</body>
</html>`, {
            runScripts: 'dangerously',
            pretendToBeVisual: true
        });

        // Mock canvas context
        const originalCreateElement = dom.window.document.createElement.bind(dom.window.document);
        dom.window.document.createElement = function (tagName) {
            const el = originalCreateElement(tagName);
            if (tagName.toLowerCase() === 'canvas') {
                el.getContext = function () {
                    return {
                        createImageData: () => ({ data: [] }),
                        putImageData: () => {},
                        getImageData: () => ({ data: [] }),
                        drawImage: () => {},
                        fillRect: () => {},
                        clearRect: () => {},
                        fillText: () => {}
                    };
                };
            }
            return el;
        };

        dom.window.AudioContext = class MockAudioContext {
            createOscillator() { return { connect() {}, start() {}, stop() {} }; }
            createGain() { return { connect() {}, gain: { value: 0 } }; }
            get destination() { return {}; }
        };
        dom.window.webkitAudioContext = dom.window.AudioContext;

        dom.window.eval(code);

        window = dom.window;
        document = dom.window.document;
        fTelnetOptions = window.fTelnetOptions;
        fTelnetClient = window.fTelnetClient;
        MobileKeyboard = window.MobileKeyboard;
        Crt = window.Crt;
        KeyboardKeys = window.KeyboardKeys;
    });

    describe('fTelnetOptions defaults', function () {
        it('should have UseNativeKeyboard enabled by default', function () {
            const opts = new fTelnetOptions();
            assert.strictEqual(opts.UseNativeKeyboard, true);
        });

        it('should have NativeKeyboardAccessoryBar enabled by default', function () {
            const opts = new fTelnetOptions();
            assert.strictEqual(opts.NativeKeyboardAccessoryBar, true);
        });

        it('should have VirtualKeyboardVisible disabled by default', function () {
            const opts = new fTelnetOptions();
            assert.strictEqual(opts.VirtualKeyboardVisible, false);
        });
    });

    describe('MobileKeyboard DOM creation and structure', function () {
        let container, crt, options, mobileKb;

        beforeEach(function () {
            container = document.createElement('div');
            document.body.appendChild(container);
            crt = new Crt(container, false);
            options = new fTelnetOptions();
            mobileKb = new MobileKeyboard(crt, container, options);
        });

        afterEach(function () {
            if (container.parentNode) {
                container.parentNode.removeChild(container);
            }
        });

        it('should create an invisible helper textarea with correct attributes', function () {
            const input = mobileKb.HelperInputElement;
            assert.ok(input, 'Helper input should exist');
            assert.strictEqual(input.tagName.toLowerCase(), 'textarea');
            assert.strictEqual(input.getAttribute('autocomplete'), 'off');
            assert.strictEqual(input.getAttribute('autocorrect'), 'off');
            assert.strictEqual(input.getAttribute('autocapitalize'), 'none');
            assert.strictEqual(input.getAttribute('spellcheck'), 'false');
            assert.strictEqual(input.style.position, 'absolute');
            assert.strictEqual(input.style.opacity, '0');
        });

        it('should create an accessory bar with primary and function rows', function () {
            const bar = mobileKb.AccessoryBarElement;
            assert.ok(bar, 'Accessory bar element should exist');
            assert.strictEqual(bar.className, 'fTelnetAccessoryBar');
            assert.strictEqual(bar.style.display, 'none', 'Should be hidden initially');

            const rows = bar.getElementsByClassName('fTelnetAccessoryRow');
            assert.strictEqual(rows.length, 2, 'Should have 2 accessory rows (primary and function)');
        });

        it('should include all required primary buttons: Esc, Tab, Ctrl, Alt, Arrows, Fn, Dismiss', function () {
            const bar = mobileKb.AccessoryBarElement;
            const primaryRow = bar.getElementsByClassName('fTelnetAccessoryRow')[0];
            const buttons = Array.from(primaryRow.getElementsByTagName('button')).map(b => b.innerHTML);

            assert.ok(buttons.includes('Esc'), 'Esc button should exist');
            assert.ok(buttons.includes('Tab'), 'Tab button should exist');
            assert.ok(buttons.includes('Ctrl'), 'Ctrl button should exist');
            assert.ok(buttons.includes('Alt'), 'Alt button should exist');
            assert.ok(buttons.includes('▲'), 'Up arrow button should exist');
            assert.ok(buttons.includes('▼'), 'Down arrow button should exist');
            assert.ok(buttons.includes('◄'), 'Left arrow button should exist');
            assert.ok(buttons.includes('►'), 'Right arrow button should exist');
            assert.ok(buttons.includes('Fn'), 'Fn button should exist');
            assert.ok(buttons.includes('Full'), 'Full button should exist');
            assert.ok(buttons.includes('⌨ ▾'), 'Dismiss keyboard button should exist');
        });

        it('should include function and navigation keys in row 2', function () {
            const bar = mobileKb.AccessoryBarElement;
            const fnRow = bar.getElementsByClassName('fTelnetAccessoryRow')[1];
            const buttons = Array.from(fnRow.getElementsByTagName('button')).map(b => b.innerHTML);

            ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'PgUp', 'PgDn', 'Home', 'End'].forEach(key => {
                assert.ok(buttons.includes(key), `${key} button should exist in function row`);
            });
        });
    });

    describe('Accessory button interactions and modifiers', function () {
        let container, crt, options, mobileKb;

        beforeEach(function () {
            container = document.createElement('div');
            document.body.appendChild(container);
            crt = new Crt(container, false);
            options = new fTelnetOptions();
            mobileKb = new MobileKeyboard(crt, container, options);
        });

        afterEach(function () {
            if (container.parentNode) {
                container.parentNode.removeChild(container);
            }
        });

        it('should latch and unlatch Ctrl modifier with visual highlight', function () {
            const bar = mobileKb.AccessoryBarElement;
            const ctrlBtn = Array.from(bar.getElementsByTagName('button')).find(b => b.innerHTML === 'Ctrl');
            assert.ok(ctrlBtn);

            // Trigger click on Ctrl
            ctrlBtn.dispatchEvent(new window.MouseEvent('mousedown'));
            assert.ok(ctrlBtn.className.includes('fTelnetAccessoryKeyLatched'), 'Ctrl button should have latched class');

            // Trigger click again to unlatch
            ctrlBtn.dispatchEvent(new window.MouseEvent('mousedown'));
            assert.ok(!ctrlBtn.className.includes('fTelnetAccessoryKeyLatched'), 'Ctrl button should not have latched class');
        });

        it('should latch and unlatch Alt modifier with visual highlight', function () {
            const bar = mobileKb.AccessoryBarElement;
            const altBtn = Array.from(bar.getElementsByTagName('button')).find(b => b.innerHTML === 'Alt');
            assert.ok(altBtn);

            altBtn.dispatchEvent(new window.MouseEvent('mousedown'));
            assert.ok(altBtn.className.includes('fTelnetAccessoryKeyLatched'), 'Alt button should have latched class');

            altBtn.dispatchEvent(new window.MouseEvent('mousedown'));
            assert.ok(!altBtn.className.includes('fTelnetAccessoryKeyLatched'), 'Alt button should unlatch');
        });

        it('should toggle function row visibility when Fn is clicked', function () {
            const bar = mobileKb.AccessoryBarElement;
            const fnBtn = Array.from(bar.getElementsByTagName('button')).find(b => b.innerHTML === 'Fn');
            const fnRow = bar.getElementsByClassName('fTelnetAccessoryRow')[1];

            assert.strictEqual(fnRow.style.display, 'none');

            fnBtn.dispatchEvent(new window.MouseEvent('mousedown'));
            assert.strictEqual(fnRow.style.display, 'flex');

            fnBtn.dispatchEvent(new window.MouseEvent('mousedown'));
            assert.strictEqual(fnRow.style.display, 'none');
        });

        it('should dismiss keyboard and accessory bar when Dismiss button is clicked', function () {
            mobileKb.Focus();
            assert.strictEqual(mobileKb.AccessoryBarVisible, true);

            const bar = mobileKb.AccessoryBarElement;
            const dismissBtn = Array.from(bar.getElementsByTagName('button')).find(b => b.innerHTML === '⌨ ▾');

            dismissBtn.dispatchEvent(new window.MouseEvent('mousedown'));
            assert.strictEqual(mobileKb.AccessoryBarVisible, false);
            assert.strictEqual(mobileKb.IsFocused, false);
        });

        it('should trigger ontogglefullkeyboard and blur when Full button is clicked', function () {
            mobileKb.Focus();
            let toggleFired = false;
            mobileKb.ontogglefullkeyboard.on(() => {
                toggleFired = true;
            });

            const bar = mobileKb.AccessoryBarElement;
            const fullBtn = Array.from(bar.getElementsByTagName('button')).find(b => b.innerHTML === 'Full');
            assert.ok(fullBtn, 'Full button should exist');

            fullBtn.dispatchEvent(new window.MouseEvent('mousedown'));
            assert.strictEqual(toggleFired, true, 'ontogglefullkeyboard event should fire');
            assert.strictEqual(mobileKb.IsFocused, false, 'MobileKeyboard should blur');
        });
    });

    describe('Text and Keystroke Processing', function () {
        let container, crt, options, mobileKb;

        beforeEach(function () {
            container = document.createElement('div');
            document.body.appendChild(container);
            crt = new Crt(container, false);
            options = new fTelnetOptions();
            mobileKb = new MobileKeyboard(crt, container, options);
        });

        afterEach(function () {
            if (container.parentNode) {
                container.parentNode.removeChild(container);
            }
        });

        it('should process regular text input and push to Crt', function () {
            mobileKb.ProcessText('Hello');

            const keys = [];
            while (crt.KeyPressed()) {
                const kpe = crt.ReadKey();
                keys.push(kpe.keyString);
            }

            assert.deepStrictEqual(keys, ['H', 'e', 'l', 'l', 'o']);
        });

        it('should handle latched Ctrl + character to send ASCII control code', function () {
            const bar = mobileKb.AccessoryBarElement;
            const ctrlBtn = Array.from(bar.getElementsByTagName('button')).find(b => b.innerHTML === 'Ctrl');

            // Latch Ctrl
            ctrlBtn.dispatchEvent(new window.MouseEvent('mousedown'));

            // Type 'c'
            mobileKb.ProcessText('c');

            const kpe = crt.ReadKey();
            assert.ok(kpe);
            assert.strictEqual(kpe.keyString, '\x03', 'Ctrl-C should produce ASCII 3');

            // Check that modifier was unlatched
            assert.ok(!ctrlBtn.className.includes('fTelnetAccessoryKeyLatched'));

            // Next character typed should be a regular character
            mobileKb.ProcessText('a');
            const kpe2 = crt.ReadKey();
            assert.strictEqual(kpe2.keyString, 'a');
        });

        it('should handle latched Alt + character to send ESC prefix', function () {
            const bar = mobileKb.AccessoryBarElement;
            const altBtn = Array.from(bar.getElementsByTagName('button')).find(b => b.innerHTML === 'Alt');

            // Latch Alt
            altBtn.dispatchEvent(new window.MouseEvent('mousedown'));

            // Type 'x'
            mobileKb.ProcessText('x');

            const kpe = crt.ReadKey();
            assert.ok(kpe);
            assert.strictEqual(kpe.keyString, '\x1Bx', 'Alt-X should produce ESC + x');
            assert.ok(!altBtn.className.includes('fTelnetAccessoryKeyLatched'));
        });

        it('should handle Enter key from keydown and beforeinput', function () {
            const input = mobileKb.HelperInputElement;

            // Keydown Enter
            const keyEvent = new window.KeyboardEvent('keydown', { keyCode: KeyboardKeys.ENTER });
            input.dispatchEvent(keyEvent);

            const kpe = crt.ReadKey();
            assert.ok(kpe);
            assert.strictEqual(kpe.keyString, '\r\n');
        });

        it('should handle Backspace key from keydown', function () {
            const input = mobileKb.HelperInputElement;

            const keyEvent = new window.KeyboardEvent('keydown', { keyCode: KeyboardKeys.BACKSPACE });
            input.dispatchEvent(keyEvent);

            const kpe = crt.ReadKey();
            assert.ok(kpe);
            assert.strictEqual(kpe.keyString, '\b');
        });

        it('should handle Arrow keys from accessory buttons', function () {
            const bar = mobileKb.AccessoryBarElement;
            const upBtn = Array.from(bar.getElementsByTagName('button')).find(b => b.innerHTML === '▲');
            const downBtn = Array.from(bar.getElementsByTagName('button')).find(b => b.innerHTML === '▼');

            upBtn.dispatchEvent(new window.MouseEvent('mousedown'));
            let kpe = crt.ReadKey();
            assert.strictEqual(kpe.keyString, '\x1B[A');

            downBtn.dispatchEvent(new window.MouseEvent('mousedown'));
            kpe = crt.ReadKey();
            assert.strictEqual(kpe.keyString, '\x1B[B');
        });
    });

    describe('Canvas tap-to-focus and touch detection', function () {
        let container, crt, options, mobileKb;

        beforeEach(function () {
            container = document.createElement('div');
            document.body.appendChild(container);
            crt = new Crt(container, false);
            options = new fTelnetOptions();
            mobileKb = new MobileKeyboard(crt, container, options);
        });

        afterEach(function () {
            if (container.parentNode) {
                container.parentNode.removeChild(container);
            }
        });

        it('should focus and show accessory bar on clean tap (touchstart + touchend)', function () {
            const canvas = crt.Canvas;

            // Simulate touchstart
            const touchStart = new window.CustomEvent('touchstart');
            touchStart.touches = [{ clientX: 100, clientY: 100 }];
            canvas.dispatchEvent(touchStart);

            // Simulate touchend without dragging
            const touchEnd = new window.CustomEvent('touchend');
            touchEnd.changedTouches = [{ clientX: 100, clientY: 100 }];
            canvas.dispatchEvent(touchEnd);

            assert.strictEqual(mobileKb.IsFocused, true);
            assert.strictEqual(mobileKb.AccessoryBarVisible, true);
        });

        it('should NOT focus if touch was a drag/swipe gesture', function () {
            const canvas = crt.Canvas;

            const touchStart = new window.CustomEvent('touchstart');
            touchStart.touches = [{ clientX: 100, clientY: 100 }];
            canvas.dispatchEvent(touchStart);

            // Dragged significantly
            const touchMove = new window.CustomEvent('touchmove');
            touchMove.touches = [{ clientX: 100, clientY: 180 }];
            canvas.dispatchEvent(touchMove);

            const touchEnd = new window.CustomEvent('touchend');
            touchEnd.changedTouches = [{ clientX: 100, clientY: 180 }];
            canvas.dispatchEvent(touchEnd);

            assert.strictEqual(mobileKb.IsFocused, false);
        });
    });

    describe('Crt.PushKeyString integration', function () {
        it('should push custom string directly to key buffer and trigger event', function () {
            const container = document.createElement('div');
            document.body.appendChild(container);
            const crt = new Crt(container, false);

            let triggered = false;
            crt.onkeypressed.on(() => {
                triggered = true;
            });

            crt.PushKeyString('\x1B[2J');
            assert.strictEqual(triggered, true);
            assert.strictEqual(crt.KeyPressed(), true);

            const kpe = crt.ReadKey();
            assert.strictEqual(kpe.keyString, '\x1B[2J');

            if (container.parentNode) {
                container.parentNode.removeChild(container);
            }
        });
    });

    describe('fTelnetClient Full Keyboard menu and toggle integration', function () {
        let container, client, options;

        beforeEach(function () {
            container = document.createElement('div');
            container.id = 'ftelnet-test-container';
            document.body.appendChild(container);

            options = new fTelnetOptions();
            options.UseNativeKeyboard = true;
            options.VirtualKeyboardVisible = false;

            client = new fTelnetClient('ftelnet-test-container', options);
        });

        afterEach(function () {
            if (container.parentNode) {
                container.parentNode.removeChild(container);
            }
        });

        it('should allow toggling VirtualKeyboardVisible directly', function () {
            assert.strictEqual(client.VirtualKeyboardVisible, false);
            client.VirtualKeyboardVisible = true;
            assert.strictEqual(client.VirtualKeyboardVisible, true);
            client.VirtualKeyboardVisible = false;
            assert.strictEqual(client.VirtualKeyboardVisible, false);
        });

        it('should toggle full software keyboard when Full button is clicked on accessory toolbar', function () {
            assert.strictEqual(client.VirtualKeyboardVisible, false);

            client.MobileKeyboard.Focus();
            assert.strictEqual(client.MobileKeyboard.IsFocused, true);

            const bar = client.MobileKeyboard.AccessoryBarElement;
            const fullBtn = Array.from(bar.getElementsByTagName('button')).find(b => b.innerHTML === 'Full');
            assert.ok(fullBtn);

            fullBtn.dispatchEvent(new window.MouseEvent('mousedown'));

            assert.strictEqual(client.VirtualKeyboardVisible, true);
            assert.strictEqual(client.MobileKeyboard.IsFocused, false);
        });
    });
});

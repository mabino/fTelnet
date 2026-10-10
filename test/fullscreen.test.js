const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

describe('Full Screen & Mobile Landscape Rotation', function () {
    const bundlePath = path.resolve(__dirname, '../release/ftelnet.norip.noxfer.js');
    const code = fs.readFileSync(bundlePath, 'utf8');

    function createTestDom(userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', width = 390, height = 844) {
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

        Object.defineProperty(dom.window.navigator, 'userAgent', {
            value: userAgent,
            configurable: true,
            writable: true
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
        dom.window.alert = () => {};

        Object.defineProperty(dom.window, 'innerWidth', { value: width, writable: true, configurable: true });
        Object.defineProperty(dom.window, 'innerHeight', { value: height, writable: true, configurable: true });

        dom.window.eval(code);
        return dom;
    }

    describe('Full Screen toggling and classes', function () {
        it('should toggle FullScreen state and add fTelnetFullScreen class', function () {
            const dom = createTestDom();
            const options = new dom.window.fTelnetOptions();
            options.Hostname = 'localhost';
            const client = new dom.window.fTelnetClient('fTelnetContainer', options);
            const container = dom.window.document.getElementById('fTelnetContainer');

            assert.strictEqual(client.FullScreen, false);
            assert.strictEqual(container.classList.contains('fTelnetFullScreen'), false);

            client.FullScreenToggle(true);
            assert.strictEqual(client.FullScreen, true);
            assert.strictEqual(container.classList.contains('fTelnetFullScreen'), true);
            assert.strictEqual(dom.window.document.body.style.overflow, 'hidden');

            // Exit full screen
            client.FullScreenToggle(false);
            assert.strictEqual(client.FullScreen, false);
            assert.strictEqual(container.classList.contains('fTelnetFullScreen'), false);
            assert.strictEqual(container.classList.contains('fTelnetLandscapeRotated'), false);
            assert.strictEqual(dom.window.document.body.style.overflow, '');
        });

        it('should update Menu item label between Full Screen and Exit Full Screen', function () {
            const dom = createTestDom();
            const options = new dom.window.fTelnetOptions();
            options.Hostname = 'localhost';
            const client = new dom.window.fTelnetClient('fTelnetContainer', options);
            
            // Search menu buttons for full screen anchor
            const links = Array.from(dom.window.document.querySelectorAll('.fTelnetMenuButtons a'));
            const fsLink = links.find(l => l.innerHTML.includes('Full&nbsp;Screen') || l.innerHTML.includes('Exit&nbsp;Full&nbsp;Screen'));
            assert(fsLink, 'FullScreen link should exist in menu');
            assert.strictEqual(fsLink.innerHTML, 'Full&nbsp;Screen');

            client.FullScreenToggle(true);
            assert.strictEqual(fsLink.innerHTML, 'Exit&nbsp;Full&nbsp;Screen');

            client.FullScreenToggle(false);
            assert.strictEqual(fsLink.innerHTML, 'Full&nbsp;Screen');
        });
    });

    describe('Mobile Landscape Rotation in Portrait Mode', function () {
        it('should add fTelnetLandscapeRotated class on mobile in portrait mode', function () {
            // iPhone in portrait: 390x844
            const dom = createTestDom('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 390, 844);
            const options = new dom.window.fTelnetOptions();
            options.Hostname = 'localhost';
            const client = new dom.window.fTelnetClient('fTelnetContainer', options);
            const container = dom.window.document.getElementById('fTelnetContainer');

            client.FullScreenToggle(true);
            assert.strictEqual(client.FullScreen, true);
            assert.strictEqual(container.classList.contains('fTelnetFullScreen'), true);
            assert.strictEqual(container.classList.contains('fTelnetLandscapeRotated'), true);
        });

        it('should NOT add fTelnetLandscapeRotated class on mobile if already in landscape', function () {
            // iPhone in landscape: 844x390
            const dom = createTestDom('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 844, 390);
            const options = new dom.window.fTelnetOptions();
            options.Hostname = 'localhost';
            const client = new dom.window.fTelnetClient('fTelnetContainer', options);
            const container = dom.window.document.getElementById('fTelnetContainer');

            client.FullScreenToggle(true);
            assert.strictEqual(client.FullScreen, true);
            assert.strictEqual(container.classList.contains('fTelnetFullScreen'), true);
            assert.strictEqual(container.classList.contains('fTelnetLandscapeRotated'), false);
        });

        it('should dynamically update rotation on resize/orientation change', function () {
            const dom = createTestDom('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 390, 844);
            const options = new dom.window.fTelnetOptions();
            options.Hostname = 'localhost';
            const client = new dom.window.fTelnetClient('fTelnetContainer', options);
            const container = dom.window.document.getElementById('fTelnetContainer');

            client.FullScreenToggle(true);
            assert.strictEqual(container.classList.contains('fTelnetLandscapeRotated'), true);

            // User physically rotates phone to landscape
            dom.window.innerWidth = 844;
            dom.window.innerHeight = 390;
            dom.window.dispatchEvent(new dom.window.Event('resize'));

            assert.strictEqual(container.classList.contains('fTelnetLandscapeRotated'), false);

            // User physically rotates phone back to portrait
            dom.window.innerWidth = 390;
            dom.window.innerHeight = 844;
            dom.window.dispatchEvent(new dom.window.Event('resize'));

            assert.strictEqual(container.classList.contains('fTelnetLandscapeRotated'), true);
        });
    });

    describe('Transparent Hamburger Button and Menu in Full Screen', function () {
        it('should render hamburger button inside container with SVG icon', function () {
            const dom = createTestDom();
            const options = new dom.window.fTelnetOptions();
            options.Hostname = 'localhost';
            const client = new dom.window.fTelnetClient('fTelnetContainer', options);
            const container = dom.window.document.getElementById('fTelnetContainer');
            const hamburger = container.querySelector('.fTelnetHamburgerButton');

            assert(hamburger, 'Hamburger button should exist inside container');
            assert.strictEqual(hamburger.getAttribute('aria-label'), 'Menu');
            assert(hamburger.querySelector('svg'), 'Hamburger button should contain an SVG icon');
        });

        it('should toggle menu buttons when hamburger button is clicked', function () {
            const dom = createTestDom();
            const options = new dom.window.fTelnetOptions();
            options.Hostname = 'localhost';
            const client = new dom.window.fTelnetClient('fTelnetContainer', options);
            const container = dom.window.document.getElementById('fTelnetContainer');
            const hamburger = container.querySelector('.fTelnetHamburgerButton');
            const menuButtons = container.querySelector('.fTelnetMenuButtons');

            assert.strictEqual(menuButtons.style.display, 'none');

            // Click hamburger
            hamburger.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
            assert.strictEqual(menuButtons.style.display, 'block');
            assert.strictEqual(menuButtons.style.right, '10px');
            assert.strictEqual(menuButtons.style.left, 'auto');

            // Click again to close
            hamburger.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
            assert.strictEqual(menuButtons.style.display, 'none');
        });

        it('should close menu when user clicks outside', function () {
            const dom = createTestDom();
            const options = new dom.window.fTelnetOptions();
            options.Hostname = 'localhost';
            const client = new dom.window.fTelnetClient('fTelnetContainer', options);
            const container = dom.window.document.getElementById('fTelnetContainer');
            const hamburger = container.querySelector('.fTelnetHamburgerButton');
            const menuButtons = container.querySelector('.fTelnetMenuButtons');

            // Open menu
            hamburger.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
            assert.strictEqual(menuButtons.style.display, 'block');

            // Click outside (e.g. document body)
            dom.window.document.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
            assert.strictEqual(menuButtons.style.display, 'none');
        });
    });
});

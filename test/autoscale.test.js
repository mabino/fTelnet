const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

describe('Responsive Viewport Auto-Scaling', function () {
    function createDOM(windowWidth = 1024, parentWidth = null, isMobile = false) {
        const bundlePath = path.resolve(__dirname, '../release/ftelnet.norip.noxfer.js');
        const code = fs.readFileSync(bundlePath, 'utf8');

        const userAgent = isMobile
            ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
            : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

        const dom = new JSDOM(`<!DOCTYPE html>
<html>
<head></head>
<body>
    <div id="parentWrapper">
        <div id="fTelnetContainer"></div>
    </div>
    <script id="fTelnetScript"></script>
</body>
</html>`, {
            runScripts: 'dangerously',
            pretendToBeVisual: true
        });

        Object.defineProperty(dom.window.navigator, 'userAgent', {
            value: userAgent,
            configurable: true
        });

        // Set window dimensions
        Object.defineProperty(dom.window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: windowWidth
        });
        Object.defineProperty(dom.window.document.documentElement, 'clientWidth', {
            writable: true,
            configurable: true,
            value: windowWidth
        });

        const parentWrapper = dom.window.document.getElementById('parentWrapper');
        Object.defineProperty(parentWrapper, 'clientWidth', {
            writable: true,
            configurable: true,
            value: parentWidth !== null ? parentWidth : windowWidth
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

        return {
            window: dom.window,
            document: dom.window.document,
            fTelnetOptions: dom.window.fTelnetOptions,
            fTelnetClient: dom.window.fTelnetClient,
            Crt: dom.window.Crt
        };
    }

    describe('fTelnetOptions defaults', function () {
        it('should have AutoScale enabled by default with MaxScale 1.0', function () {
            const env = createDOM(1024);
            const options = new env.fTelnetOptions();
            assert.strictEqual(options.AutoScale, true);
            assert.strictEqual(options.MaxScale, 1.0);
        });
    });

    describe('Scaling on wide screens (>= native width)', function () {
        it('should remain at 1.0 native scale on wide displays', function () {
            const env = createDOM(1024, null, false);
            const options = new env.fTelnetOptions();
            options.Hostname = 'localhost';
            const client = new env.fTelnetClient('fTelnetContainer', options);

            const container = env.document.getElementById('fTelnetContainer');
            const clientContainer = container.querySelector('.fTelnetClientContainer');
            const canvas = container.querySelector('canvas');

            // Native width for 80 cols * 9px font width = 720px
            assert.strictEqual(clientContainer.style.width, '720px');
            assert.strictEqual(container.style.width, '720px');
        });
    });

    describe('Downscaling on narrow mobile viewports (< native width)', function () {
        it('should downscale container and canvas proportionally on mobile devices', function () {
            // Viewport width 360px on mobile device (classic scrollback)
            const env = createDOM(360, null, true);
            const options = new env.fTelnetOptions();
            options.Hostname = 'localhost';
            const client = new env.fTelnetClient('fTelnetContainer', options);

            const container = env.document.getElementById('fTelnetContainer');
            const clientContainer = container.querySelector('.fTelnetClientContainer');
            const canvas = container.querySelector('canvas');
            const statusBar = container.querySelector('.fTelnetStatusBar');
            const accessoryBar = container.querySelector('.fTelnetAccessoryBar');

            // Scale is 360 / 720 = 0.5
            // Native: 720x400 -> Scaled: 360x200
            assert.strictEqual(clientContainer.style.width, '360px');
            assert.strictEqual(clientContainer.style.height, '200px');
            assert.strictEqual(canvas.style.width, '360px');
            assert.strictEqual(canvas.style.height, '200px');
            assert.strictEqual(container.style.width, '360px');

            // Status bar should be DisplayWidth - 10px padding = 350px
            assert.strictEqual(statusBar.style.width, '350px');

            // Mobile accessory bar should match DisplayWidth
            if (accessoryBar) {
                assert.strictEqual(accessoryBar.style.width, '360px');
            }
        });

        it('should not scale down when AutoScale is false', function () {
            const env = createDOM(360, null, true);
            const options = new env.fTelnetOptions();
            options.Hostname = 'localhost';
            options.AutoScale = false;
            const client = new env.fTelnetClient('fTelnetContainer', options);

            const container = env.document.getElementById('fTelnetContainer');
            const clientContainer = container.querySelector('.fTelnetClientContainer');

            // When AutoScale is disabled, width remains 720px
            assert.strictEqual(clientContainer.style.width, '720px');
        });
    });

    describe('Dynamic window resizing', function () {
        it('should dynamically update scale on mobile window resize events', function () {
            const env = createDOM(800, null, true);
            const options = new env.fTelnetOptions();
            options.Hostname = 'localhost';
            const client = new env.fTelnetClient('fTelnetContainer', options);

            const container = env.document.getElementById('fTelnetContainer');
            const clientContainer = container.querySelector('.fTelnetClientContainer');
            const canvas = container.querySelector('canvas');

            assert.strictEqual(clientContainer.style.width, '720px');

            // Simulate window resize/rotation to mobile portrait width 390px
            env.window.innerWidth = 390;
            env.document.documentElement.clientWidth = 390;
            const parentWrapper = env.document.getElementById('parentWrapper');
            parentWrapper.clientWidth = 390;

            env.window.dispatchEvent(new env.window.Event('resize'));

            // Scale = 390 / 720 = 0.541666...
            // Width = 390, Height = Math.floor(400 * (390/720)) = 216
            assert.strictEqual(clientContainer.style.width, '390px');
            assert.strictEqual(clientContainer.style.height, '216px');
            assert.strictEqual(canvas.style.width, '390px');
            assert.strictEqual(canvas.style.height, '216px');
            assert.strictEqual(container.style.width, '390px');
        });
    });

    describe('Respecting parent container constrained width and padding', function () {
        it('should constrain to parent element width when smaller than window.innerWidth', function () {
            // Window is 1920px wide desktop, but parentWrapper is 480px wide
            const env = createDOM(1920, 480, true);
            const options = new env.fTelnetOptions();
            options.Hostname = 'localhost';
            const client = new env.fTelnetClient('fTelnetContainer', options);

            const container = env.document.getElementById('fTelnetContainer');
            const clientContainer = container.querySelector('.fTelnetClientContainer');

            // Scale = 480 / 720 = 0.6666...
            assert.strictEqual(clientContainer.style.width, '480px');
            assert.strictEqual(clientContainer.style.height, '266px');
        });

        it('should scale modern scrollback canvas height proportionately on desktop', function () {
            // Desktop with modern scrollback enabled, scaled to 360px
            const env = createDOM(360, null, false);
            const options = new env.fTelnetOptions();
            options.Hostname = 'localhost';
            options.AllowModernScrollback = true;
            const client = new env.fTelnetClient('fTelnetContainer', options);

            const container = env.document.getElementById('fTelnetContainer');
            const clientContainer = container.querySelector('.fTelnetClientContainer');
            const canvas = container.querySelector('canvas');

            // Container height is viewport height: 200px
            assert.strictEqual(clientContainer.style.height, '200px');
            // Canvas inside container has 250 rows scrollback buffer: (25 + 250) * 16 * 0.5 = 2200px
            assert.strictEqual(canvas.style.height, '2200px');
        });
    });
});

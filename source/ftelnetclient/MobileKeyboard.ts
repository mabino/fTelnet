/*
  fTelnet: An HTML5 WebSocket client
  Copyright (C) Rick Parrish, R&M Software

  This file is part of fTelnet.

  fTelnet is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as
  published by the Free Software Foundation, either version 3 of the
  License, or any later version.

  fTelnet is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with fTelnet.  If not, see <http://www.gnu.org/licenses/>.
*/

class MobileKeyboard {
    // Events
    public ontogglefullkeyboard: IEvent = new TypedEvent();

    private _Crt: Crt;
    private _Container: HTMLElement;
    private _Options: fTelnetOptions;

    private _Input: HTMLTextAreaElement;
    private _AccessoryBar: HTMLDivElement;
    private _PrimaryRow: HTMLDivElement;
    private _FunctionRow: HTMLDivElement;

    private _CtrlButton: HTMLButtonElement;
    private _AltButton: HTMLButtonElement;
    private _FnButton: HTMLButtonElement;

    private _CtrlLatched: boolean = false;
    private _AltLatched: boolean = false;
    private _FunctionRowVisible: boolean = false;
    private _IsFocused: boolean = false;
    private _AccessoryBarEnabled: boolean = true;

    private _TouchStartX: number = 0;
    private _TouchStartY: number = 0;
    private _TouchStartTime: number = 0;
    private _IsDragging: boolean = false;

    private _LastInputType: string = '';
    private _LastInputTime: number = 0;

    constructor(crt: Crt, container: HTMLElement, options: fTelnetOptions) {
        this._Crt = crt;
        this._Container = container;
        this._Options = options;
        this._AccessoryBarEnabled = options.NativeKeyboardAccessoryBar;

        this.CreateHelperInput();
        this.CreateAccessoryBar();
        this.AttachCanvasListeners();
    }

    private CreateHelperInput(): void {
        this._Input = document.createElement('textarea');
        this._Input.id = 'fTelnetMobileInput';
        this._Input.className = 'fTelnetMobileInput';
        this._Input.setAttribute('autocomplete', 'off');
        this._Input.setAttribute('autocorrect', 'off');
        this._Input.setAttribute('autocapitalize', 'none');
        this._Input.setAttribute('spellcheck', 'false');
        this._Input.setAttribute('tabindex', '-1');
        this._Input.setAttribute('aria-hidden', 'true');
        this._Input.setAttribute('rows', '1');
        this._Input.setAttribute('cols', '1');

        // Apply robust inline styling so helper input stays invisible and does not displace layout
        this._Input.style.position = 'absolute';
        this._Input.style.left = '0';
        this._Input.style.top = '0';
        this._Input.style.width = '1px';
        this._Input.style.height = '1px';
        this._Input.style.padding = '0';
        this._Input.style.margin = '0';
        this._Input.style.border = 'none';
        this._Input.style.outline = 'none';
        this._Input.style.opacity = '0';
        this._Input.style.background = 'transparent';
        this._Input.style.color = 'transparent';
        this._Input.style.pointerEvents = 'none';
        this._Input.style.zIndex = '0';
        this._Input.style.fontSize = '16px';
        this._Input.style.resize = 'none';
        this._Input.style.overflow = 'hidden';
        this._Input.style.whiteSpace = 'nowrap';

        // Event listeners
        this._Input.addEventListener('keydown', (ke: KeyboardEvent): void => {
            this.OnInputKeyDown(ke);
        }, false);

        // Modern browsers fire beforeinput with structured inputType
        this._Input.addEventListener('beforeinput', (e: any): void => {
            this.OnInputBeforeInput(e);
        }, false);

        // Fallback input event for browsers or composition where beforeinput is not supported
        this._Input.addEventListener('input', (): void => {
            if (this._Input.value.length > 0) {
                this.ProcessText(this._Input.value);
                this._Input.value = '';
            }
        }, false);

        this._Input.addEventListener('compositionend', (e: CompositionEvent): void => {
            if (e.data && e.data.length > 0) {
                this.ProcessText(e.data);
                this._Input.value = '';
            }
        }, false);

        this._Input.addEventListener('focus', (): void => {
            this._IsFocused = true;
            if (this._AccessoryBarEnabled && this._AccessoryBar) {
                this._AccessoryBar.style.display = 'block';
            }
        }, false);

        this._Input.addEventListener('blur', (): void => {
            this._IsFocused = false;
            if (this._AccessoryBar) {
                this._AccessoryBar.style.display = 'none';
            }
            this.ClearModifiers();
        }, false);

        this._Container.appendChild(this._Input);
    }

    private CreateAccessoryBar(): void {
        this._AccessoryBar = document.createElement('div');
        this._AccessoryBar.className = 'fTelnetAccessoryBar';
        this._AccessoryBar.style.display = 'none';
        this._AccessoryBar.style.boxSizing = 'border-box';
        this._AccessoryBar.style.backgroundColor = '#1a1a1a';
        this._AccessoryBar.style.border = '1px solid #333333';
        this._AccessoryBar.style.borderRadius = '4px';
        this._AccessoryBar.style.padding = '4px';
        this._AccessoryBar.style.margin = '4px auto';
        this._AccessoryBar.style.userSelect = 'none';
        (this._AccessoryBar.style as any).webkitUserSelect = 'none';
        (this._AccessoryBar.style as any).touchAction = 'manipulation';

        // Row 1: Primary control row
        this._PrimaryRow = document.createElement('div');
        this._PrimaryRow.className = 'fTelnetAccessoryRow';
        this._PrimaryRow.style.display = 'flex';
        this._PrimaryRow.style.flexWrap = 'nowrap';
        this._PrimaryRow.style.justifyContent = 'space-between';
        this._PrimaryRow.style.alignItems = 'center';
        (this._PrimaryRow.style as any).gap = '4px';
        this._PrimaryRow.style.width = '100%';

        this.AddButton(this._PrimaryRow, 'Esc', (): void => {
            this.SendKey(KeyboardKeys.ESCAPE);
        });

        this.AddButton(this._PrimaryRow, 'Tab', (): void => {
            this.SendKey(KeyboardKeys.TAB);
        });

        this._CtrlButton = this.AddButton(this._PrimaryRow, 'Ctrl', (): void => {
            this._CtrlLatched = !this._CtrlLatched;
            this.UpdateModifierHighlight();
        });

        this._AltButton = this.AddButton(this._PrimaryRow, 'Alt', (): void => {
            this._AltLatched = !this._AltLatched;
            this.UpdateModifierHighlight();
        });

        this.AddButton(this._PrimaryRow, '▲', (): void => {
            this.SendKey(KeyboardKeys.UP);
        });

        this.AddButton(this._PrimaryRow, '▼', (): void => {
            this.SendKey(KeyboardKeys.DOWN);
        });

        this.AddButton(this._PrimaryRow, '◄', (): void => {
            this.SendKey(KeyboardKeys.LEFT);
        });

        this.AddButton(this._PrimaryRow, '►', (): void => {
            this.SendKey(KeyboardKeys.RIGHT);
        });

        this._FnButton = this.AddButton(this._PrimaryRow, 'Fn', (): void => {
            this._FunctionRowVisible = !this._FunctionRowVisible;
            this._FunctionRow.style.display = this._FunctionRowVisible ? 'flex' : 'none';
            this.UpdateModifierHighlight();
        }, 'fTelnetAccessoryKeyFn');

        this.AddButton(this._PrimaryRow, 'Full', (): void => {
            this.Blur();
            this.ontogglefullkeyboard.trigger();
        }, 'fTelnetAccessoryKeyFull');

        this.AddButton(this._PrimaryRow, '⌨ ▾', (): void => {
            this.Blur();
        }, 'fTelnetAccessoryKeyDismiss');

        this._AccessoryBar.appendChild(this._PrimaryRow);

        // Row 2: Function and navigation keys row
        this._FunctionRow = document.createElement('div');
        this._FunctionRow.className = 'fTelnetAccessoryRow';
        this._FunctionRow.style.display = 'none';
        this._FunctionRow.style.flexWrap = 'nowrap';
        this._FunctionRow.style.justifyContent = 'space-between';
        this._FunctionRow.style.alignItems = 'center';
        (this._FunctionRow.style as any).gap = '3px';
        this._FunctionRow.style.width = '100%';
        this._FunctionRow.style.marginTop = '4px';

        var fKeys: { label: string, key: number }[] = [
            { label: 'F1', key: KeyboardKeys.F1 },
            { label: 'F2', key: KeyboardKeys.F2 },
            { label: 'F3', key: KeyboardKeys.F3 },
            { label: 'F4', key: KeyboardKeys.F4 },
            { label: 'F5', key: KeyboardKeys.F5 },
            { label: 'F6', key: KeyboardKeys.F6 },
            { label: 'F7', key: KeyboardKeys.F7 },
            { label: 'F8', key: KeyboardKeys.F8 },
            { label: 'F9', key: KeyboardKeys.F9 },
            { label: 'F10', key: KeyboardKeys.F10 },
            { label: 'PgUp', key: KeyboardKeys.PAGE_UP },
            { label: 'PgDn', key: KeyboardKeys.PAGE_DOWN },
            { label: 'Home', key: KeyboardKeys.HOME },
            { label: 'End', key: KeyboardKeys.END }
        ];

        for (var i = 0; i < fKeys.length; i++) {
            ((): void => {
                var keyDef = fKeys[i];
                this.AddButton(this._FunctionRow, keyDef.label, (): void => {
                    this.SendKey(keyDef.key);
                });
            })();
        }

        this._AccessoryBar.appendChild(this._FunctionRow);
        this._Container.appendChild(this._AccessoryBar);
    }

    private AddButton(row: HTMLElement, label: string, action: () => void, extraClass?: string): HTMLButtonElement {
        var btn: HTMLButtonElement = document.createElement('button');
        btn.type = 'button';
        btn.innerHTML = label;
        btn.className = 'fTelnetAccessoryKey' + (extraClass ? (' ' + extraClass) : '');

        btn.style.flex = '1 1 0';
        btn.style.minWidth = '0';
        btn.style.height = '36px';
        btn.style.lineHeight = '36px';
        btn.style.margin = '0';
        btn.style.padding = '0';
        btn.style.fontSize = '13px';
        btn.style.fontWeight = '500';
        btn.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
        btn.style.backgroundColor = '#2e2e2e';
        btn.style.color = '#e0e0e0';
        btn.style.border = '1px solid #4a4a4a';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.style.textAlign = 'center';
        (btn.style as any).touchAction = 'manipulation';
        (btn.style as any).webkitTapHighlightColor = 'transparent';

        var wasHandledByTouch: boolean = false;

        var executeAction = (): void => {
            this.TriggerVibrate();
            action();
        };

        // Important: preventDefault on touchstart and mousedown keeps focus in the helper textarea
        // so the mobile virtual keyboard remains open!
        btn.addEventListener('touchstart', (e: TouchEvent): void => {
            e.preventDefault();
            wasHandledByTouch = true;
            executeAction();
        }, false);

        btn.addEventListener('mousedown', (e: MouseEvent): void => {
            e.preventDefault();
            if (!wasHandledByTouch) {
                executeAction();
            }
        }, false);

        btn.addEventListener('click', (e: MouseEvent): void => {
            e.preventDefault();
            if (wasHandledByTouch) {
                wasHandledByTouch = false;
            }
        }, false);

        row.appendChild(btn);
        return btn;
    }

    private AttachCanvasListeners(): void {
        var canvas: HTMLCanvasElement = this._Crt.Canvas;
        if (!canvas) { return; }

        canvas.addEventListener('touchstart', (e: TouchEvent): void => {
            if (!this._Options.UseNativeKeyboard) { return; }
            if (e.touches.length === 1) {
                this._TouchStartX = e.touches[0].clientX;
                this._TouchStartY = e.touches[0].clientY;
                this._TouchStartTime = Date.now();
                this._IsDragging = false;
            }
        }, { passive: true } as any);

        canvas.addEventListener('touchmove', (e: TouchEvent): void => {
            if (e.touches.length === 1) {
                var dx: number = Math.abs(e.touches[0].clientX - this._TouchStartX);
                var dy: number = Math.abs(e.touches[0].clientY - this._TouchStartY);
                if (dx > 10 || dy > 10) {
                    this._IsDragging = true;
                }
            }
        }, { passive: true } as any);

        canvas.addEventListener('touchend', (e: TouchEvent): void => {
            if (!this._Options.UseNativeKeyboard) { return; }
            if (!this._IsDragging && (Date.now() - this._TouchStartTime) < 500) {
                this.Focus();
            }
        }, false);

        canvas.addEventListener('click', (): void => {
            if (!this._Options.UseNativeKeyboard) { return; }
            if (DetectMobileBrowser.IsMobile) {
                this.Focus();
            }
        }, false);
    }

    private OnInputKeyDown(ke: KeyboardEvent): void {
        var keyCode: number = ke.keyCode;

        if (keyCode === KeyboardKeys.ENTER) {
            ke.preventDefault();
            this._Crt.PushKeyDown(0, KeyboardKeys.ENTER, this._CtrlLatched, this._AltLatched, ke.shiftKey);
            this.ClearModifiers();
            this._Input.value = '';
            this._LastInputType = 'enter';
            this._LastInputTime = Date.now();
            return;
        }

        if (keyCode === KeyboardKeys.BACKSPACE) {
            ke.preventDefault();
            this._Crt.PushKeyDown(0, KeyboardKeys.BACKSPACE, this._CtrlLatched, this._AltLatched, ke.shiftKey);
            this.ClearModifiers();
            this._Input.value = '';
            this._LastInputType = 'backspace';
            this._LastInputTime = Date.now();
            return;
        }

        if (keyCode === KeyboardKeys.TAB) {
            ke.preventDefault();
            this._Crt.PushKeyDown(0, KeyboardKeys.TAB, this._CtrlLatched, this._AltLatched, ke.shiftKey);
            this.ClearModifiers();
            this._Input.value = '';
            return;
        }

        if (keyCode === KeyboardKeys.ESCAPE) {
            ke.preventDefault();
            this._Crt.PushKeyDown(0, KeyboardKeys.ESCAPE, this._CtrlLatched, this._AltLatched, ke.shiftKey);
            this.ClearModifiers();
            this._Input.value = '';
            return;
        }

        if (keyCode === KeyboardKeys.UP || keyCode === KeyboardKeys.DOWN ||
            keyCode === KeyboardKeys.LEFT || keyCode === KeyboardKeys.RIGHT) {
            ke.preventDefault();
            this._Crt.PushKeyDown(0, keyCode, this._CtrlLatched, this._AltLatched, ke.shiftKey);
            this.ClearModifiers();
            return;
        }

        // If physical keyboard or platform fires standard key with ctrl or alt
        if ((ke.ctrlKey || this._CtrlLatched || ke.altKey || this._AltLatched) && ke.key && ke.key.length === 1 && keyCode !== 229) {
            ke.preventDefault();
            this.ProcessText(ke.key);
            this._Input.value = '';
            return;
        }
    }

    private OnInputBeforeInput(e: any): void {
        var inputType: string = e.inputType || '';

        if (inputType === 'insertLineBreak' || inputType === 'insertParagraph') {
            e.preventDefault();
            if (!(this._LastInputType === 'enter' && (Date.now() - this._LastInputTime) < 60)) {
                this._Crt.PushKeyDown(0, KeyboardKeys.ENTER, this._CtrlLatched, this._AltLatched, false);
                this.ClearModifiers();
            }
            this._Input.value = '';
            this._LastInputType = 'enter';
            this._LastInputTime = Date.now();
            return;
        }

        if (inputType === 'deleteContentBackward' || inputType === 'deleteContentForward') {
            e.preventDefault();
            if (!(this._LastInputType === 'backspace' && (Date.now() - this._LastInputTime) < 60)) {
                this._Crt.PushKeyDown(0, KeyboardKeys.BACKSPACE, this._CtrlLatched, this._AltLatched, false);
                this.ClearModifiers();
            }
            this._Input.value = '';
            this._LastInputType = 'backspace';
            this._LastInputTime = Date.now();
            return;
        }

        if (inputType === 'insertText') {
            e.preventDefault();
            if (typeof e.data === 'string' && e.data.length > 0) {
                this.ProcessText(e.data);
            }
            this._Input.value = '';
            return;
        }
    }

    public ProcessText(text: string): void {
        for (var i: number = 0; i < text.length; i++) {
            var ch: string = text.charAt(i);
            var code: number = text.charCodeAt(i);

            if (this._CtrlLatched) {
                this._CtrlLatched = false;
                this.UpdateModifierHighlight();
                if ((code >= 65) && (code <= 90)) {
                    this._Crt.PushKeyString(String.fromCharCode(code - 64));
                } else if ((code >= 97) && (code <= 122)) {
                    this._Crt.PushKeyString(String.fromCharCode(code - 96));
                } else {
                    this._Crt.PushKeyString(ch);
                }
            } else if (this._AltLatched) {
                this._AltLatched = false;
                this.UpdateModifierHighlight();
                this._Crt.PushKeyString('\x1B' + ch);
            } else if (ch === '\r' || ch === '\n') {
                this._Crt.PushKeyDown(0, KeyboardKeys.ENTER, false, false, false);
            } else if (ch === ' ') {
                this._Crt.PushKeyDown(0, KeyboardKeys.SPACE, false, false, false);
            } else if (code >= 32) {
                this._Crt.PushKeyPress(code, 0, false, false, false);
            }
        }
    }

    private SendKey(keyCode: number): void {
        this._Crt.PushKeyDown(0, keyCode, this._CtrlLatched, this._AltLatched, false);
        this.ClearModifiers();
    }

    public ClearModifiers(): void {
        if (this._CtrlLatched || this._AltLatched) {
            this._CtrlLatched = false;
            this._AltLatched = false;
            this.UpdateModifierHighlight();
        }
    }

    public UpdateModifierHighlight(): void {
        if (this._CtrlButton) {
            if (this._CtrlLatched) {
                this._CtrlButton.style.backgroundColor = '#0d47a1';
                this._CtrlButton.style.borderColor = '#42a5f5';
                this._CtrlButton.style.color = '#ffffff';
                this._CtrlButton.className = 'fTelnetAccessoryKey fTelnetAccessoryKeyLatched';
            } else {
                this._CtrlButton.style.backgroundColor = '#2e2e2e';
                this._CtrlButton.style.borderColor = '#4a4a4a';
                this._CtrlButton.style.color = '#e0e0e0';
                this._CtrlButton.className = 'fTelnetAccessoryKey';
            }
        }

        if (this._AltButton) {
            if (this._AltLatched) {
                this._AltButton.style.backgroundColor = '#0d47a1';
                this._AltButton.style.borderColor = '#42a5f5';
                this._AltButton.style.color = '#ffffff';
                this._AltButton.className = 'fTelnetAccessoryKey fTelnetAccessoryKeyLatched';
            } else {
                this._AltButton.style.backgroundColor = '#2e2e2e';
                this._AltButton.style.borderColor = '#4a4a4a';
                this._AltButton.style.color = '#e0e0e0';
                this._AltButton.className = 'fTelnetAccessoryKey';
            }
        }

        if (this._FnButton) {
            if (this._FunctionRowVisible) {
                this._FnButton.style.backgroundColor = '#1565c0';
                this._FnButton.style.borderColor = '#42a5f5';
                this._FnButton.style.color = '#ffffff';
            } else {
                this._FnButton.style.backgroundColor = '#243447';
                this._FnButton.style.borderColor = '#4a4a4a';
                this._FnButton.style.color = '#e0e0e0';
            }
        }
    }

    public TriggerVibrate(): void {
        if (!!navigator.vibrate && (this._Options.VirtualKeyboardVibrateDuration > 0)) {
            navigator.vibrate(this._Options.VirtualKeyboardVibrateDuration);
        }
    }

    public Focus(): void {
        if (this._Input) {
            this._Input.focus();
            this._IsFocused = true;
            if (this._AccessoryBarEnabled && this._AccessoryBar) {
                this._AccessoryBar.style.display = 'block';
            }
        }
    }

    public Blur(): void {
        if (this._Input) {
            this._Input.blur();
            this._IsFocused = false;
            if (this._AccessoryBar) {
                this._AccessoryBar.style.display = 'none';
            }
        }
    }

    public Toggle(): void {
        if (this._IsFocused) {
            this.Blur();
        } else {
            this.Focus();
        }
    }

    public SetWidth(width: number): void {
        if (this._AccessoryBar) {
            this._AccessoryBar.style.width = width + 'px';
            this._AccessoryBar.style.maxWidth = '100%';
        }
    }

    public get IsFocused(): boolean {
        return this._IsFocused;
    }

    public get AccessoryBarEnabled(): boolean {
        return this._AccessoryBarEnabled;
    }

    public set AccessoryBarEnabled(value: boolean) {
        this._AccessoryBarEnabled = value;
        if (!value && this._AccessoryBar) {
            this._AccessoryBar.style.display = 'none';
        } else if (value && this._IsFocused && this._AccessoryBar) {
            this._AccessoryBar.style.display = 'block';
        }
    }

    public get AccessoryBarVisible(): boolean {
        return (this._AccessoryBar && this._AccessoryBar.style.display !== 'none');
    }

    public set AccessoryBarVisible(value: boolean) {
        if (this._AccessoryBar) {
            this._AccessoryBar.style.display = value ? 'block' : 'none';
        }
    }

    public get HelperInputElement(): HTMLTextAreaElement {
        return this._Input;
    }

    public get AccessoryBarElement(): HTMLDivElement {
        return this._AccessoryBar;
    }
}

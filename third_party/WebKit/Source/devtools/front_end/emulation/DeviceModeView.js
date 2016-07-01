// Copyright 2015 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @constructor
 * @extends {WebInspector.VBox}
 * @param {!WebInspector.InspectedPagePlaceholder} inspectedPagePlaceholder
 */
WebInspector.DeviceModeView = function(inspectedPagePlaceholder)
{
    WebInspector.VBox.call(this, true);
    this.setMinimumSize(150, 150);
    this.element.classList.add("device-mode-view");
    this.registerRequiredCSS("emulation/deviceModeView.css");
    WebInspector.Tooltip.addNativeOverrideContainer(this.contentElement);

    this._model = new WebInspector.DeviceModeModel(this._updateUI.bind(this));
    this._mediaInspector = new WebInspector.MediaQueryInspector(this._model.genericWidthSetting());
    // TODO(dgozman): better full control, controlling mode, persist type/device, more fit options.

    this._inspectedPagePlaceholder = inspectedPagePlaceholder;
    this._createUI();
    WebInspector.zoomManager.addEventListener(WebInspector.ZoomManager.Events.ZoomChanged, this._updateUI, this);
};

WebInspector.DeviceModeView.prototype = {
    _createUI: function()
    {
        var toolbarContainer = this.contentElement.createChild("div", "device-mode-toolbar");
        var mediaInspectorContainer = this.contentElement.createChild("div", "device-mode-media-container");
        this._contentArea = this.contentElement.createChild("div", "device-mode-content-area");

        this._screenArea = this._contentArea.createChild("div", "device-mode-screen-area");
        this._screenImage = this._screenArea.createChild("img", "device-mode-screen-image hidden");
        this._screenImage.addEventListener("load", this._onScreenImageLoaded.bind(this, true), false);
        this._screenImage.addEventListener("error", this._onScreenImageLoaded.bind(this, false), false);

        this._resizerElement = this._screenArea.createChild("div", "device-mode-resizer");
        this._resizerElement.createChild("div", "");
        this._createResizer(this._resizerElement);

        this._pageArea = this._screenArea.createChild("div", "device-mode-page-area");
        this._inspectedPagePlaceholder.clearMinimumSizeAndMargins();
        this._inspectedPagePlaceholder.show(this._pageArea);

        this._warningInfobar = new WebInspector.Infobar(WebInspector.Infobar.Type.Warning, WebInspector.moduleSetting("disableOverridesWarning"));
        this._warningInfobar.element.classList.add("device-mode-warning");
        this._warningInfobar.setCloseCallback(this._model.clearWarning.bind(this._model));
        this._contentArea.appendChild(this._warningInfobar.element);
        this._warningMessage = this._warningInfobar.element.createChild("span");

        this._createToolbar(toolbarContainer, mediaInspectorContainer);
    },

    /**
     * @param {!Element} toolbarContainer
     * @param {!Element} mediaInspectorContainer
     */
    _createToolbar: function(toolbarContainer, mediaInspectorContainer)
    {
        var toolbar = new WebInspector.Toolbar(toolbarContainer);

        var deviceSelect = this._createDeviceSelect();
        var deviceSelectItem = new WebInspector.ToolbarItem(this._wrapToolbarItem(deviceSelect));
        toolbar.appendToolbarItem(deviceSelectItem);
        toolbar.appendSeparator();

        var genericWidthInput = createElementWithClass("input", "device-mode-size-input");
        genericWidthInput.maxLength = 5;
        genericWidthInput.placeholder = WebInspector.UIString("Full");
        WebInspector.SettingsUI.bindSettingInputField(genericWidthInput, this._model.genericWidthSetting(), true, WebInspector.DeviceModeModel.deviceSizeValidator, true, true);
        this._genericWidthItem = new WebInspector.ToolbarItem(this._wrapToolbarItem(genericWidthInput));
        toolbar.appendToolbarItem(this._genericWidthItem);

        this._deviceSizeInput = createElementWithClass("input", "device-mode-size-input");
        this._deviceSizeInput.disabled = true;
        this._deviceSizeInput.style.opacity = "0.7";
        this._deviceSizeItem = new WebInspector.ToolbarItem(this._wrapToolbarItem(this._deviceSizeInput));
        toolbar.appendToolbarItem(this._deviceSizeItem);
        toolbar.appendSeparator();

        var fitCheckbox = WebInspector.SettingsUI.createSettingCheckbox(WebInspector.UIString("Fit"), this._model.fitSetting(), true, WebInspector.UIString("Zoom to fit available space"));
        var fitItem = new WebInspector.ToolbarItem(fitCheckbox);
        toolbar.appendToolbarItem(fitItem);
        toolbar.appendSeparator();

        var mediaInspectorButton = new WebInspector.DeviceModeView.MediaInspectorButton(this._mediaInspector, mediaInspectorContainer, this.onResize.bind(this));
        toolbar.appendToolbarItem(mediaInspectorButton.button());
    },

    /**
     * @param {!Element} element
     * @return {!Element}
     */
    _wrapToolbarItem: function(element)
    {
        var container = createElement("div");
        var shadowRoot = WebInspector.createShadowRootWithCoreStyles(container);
        shadowRoot.appendChild(WebInspector.Widget.createStyleElement("emulation/deviceModeToolbar.css"));
        shadowRoot.appendChild(element);
        return container;
    },

    /**
     * @return {!Element}
     */
    _createDeviceSelect: function()
    {
        var select = createElementWithClass("select", "device-mode-device-select");
        WebInspector.emulatedDevicesList.addEventListener(WebInspector.EmulatedDevicesList.Events.CustomDevicesUpdated, deviceListChanged, this);
        WebInspector.emulatedDevicesList.addEventListener(WebInspector.EmulatedDevicesList.Events.StandardDevicesUpdated, deviceListChanged, this);
        deviceListChanged.call(this);
        select.addEventListener("change", optionSelected.bind(this), false);
        return select;

        /**
         * @this {WebInspector.DeviceModeView}
         */
        function deviceListChanged()
        {
            select.removeChildren();

            var genericGroup = select.createChild("optgroup");
            genericGroup.label = WebInspector.UIString("Generic");
            addOption.call(this, genericGroup, WebInspector.DeviceModeModel.Type.Mobile, null);
            addOption.call(this, genericGroup, WebInspector.DeviceModeModel.Type.Tablet, null);
            addOption.call(this, genericGroup, WebInspector.DeviceModeModel.Type.Desktop, null);

            var deviceGroup = select.createChild("optgroup");
            deviceGroup.label = WebInspector.UIString("Devices");
            var devices = WebInspector.emulatedDevicesList.custom().concat(WebInspector.emulatedDevicesList.standard());
            devices.sort(WebInspector.EmulatedDevice.compareByTitle);
            for (var device of devices) {
                if (device.show())
                    addOption.call(this, deviceGroup, WebInspector.DeviceModeModel.Type.Device, device);
            }
        }

        /**
         * @param {!Element} group
         * @param {!WebInspector.DeviceModeModel.Type} type
         * @param {?WebInspector.EmulatedDevice} device
         * @this {WebInspector.DeviceModeView}
         */
        function addOption(group, type, device)
        {
            var title = type === WebInspector.DeviceModeModel.Type.Device ? device.title : WebInspector.UIString(type);
            var option = new Option(title, title);
            option.device = device;
            option.type = type;
            group.appendChild(option);

            if (type === this._model.type() && device === this._model.device())
                select.selectedIndex = Array.prototype.slice.call(select.options).indexOf(option);
        }

        /**
         * @this {WebInspector.DeviceModeView}
         */
        function optionSelected()
        {
            var option = select.options[select.selectedIndex];
            this._model.emulate(option.type, option.device);
            if (option.type !== WebInspector.DeviceModeModel.Type.Desktop)
                WebInspector.userMetrics.actionTaken(WebInspector.UserMetrics.Action.DeviceModeEnabled);
        }
    },

    /**
     * @param {!Element} element
     * @return {!WebInspector.ResizerWidget}
     */
    _createResizer: function(element)
    {
        var resizer = new WebInspector.ResizerWidget();
        resizer.addElement(element);
        resizer.setCursor("ew-resize");
        resizer.addEventListener(WebInspector.ResizerWidget.Events.ResizeStart, this._onResizeStart, this);
        resizer.addEventListener(WebInspector.ResizerWidget.Events.ResizeUpdate, this._onResizeUpdate, this);
        resizer.addEventListener(WebInspector.ResizerWidget.Events.ResizeEnd, this._onResizeEnd, this);
        return resizer;
    },

    /**
     * @param {!WebInspector.Event} event
     */
    _onResizeStart: function(event)
    {
        this._slowPositionStart = null;
        this._resizeStart = this._model.screenRect().width;
        this._model.suspendFitScaleChanges();
    },

    /**
     * @param {!WebInspector.Event} event
     */
    _onResizeUpdate: function(event)
    {
        if (event.data.shiftKey !== !!this._slowPositionStart)
            this._slowPositionStart = event.data.shiftKey ? event.data.currentX : null;

        var cssOffset = event.data.currentX - event.data.startX;
        if (this._slowPositionStart)
            cssOffset = (event.data.currentX - this._slowPositionStart) / 10 + this._slowPositionStart - event.data.startX;
        var dipOffset = cssOffset * WebInspector.zoomManager.zoomFactor();

        var newWidth = this._resizeStart + dipOffset * 2;
        newWidth = Math.round(newWidth / this._model.fitScale());
        newWidth = Math.max(Math.min(newWidth, WebInspector.DeviceModeModel.MaxDeviceSize), 1);
        this._model.genericWidthSetting().set(newWidth);
    },

    /**
     * @param {!WebInspector.Event} event
     */
    _onResizeEnd: function(event)
    {
        delete this._resizeStart;
        this._model.resumeFitScaleChanges();
    },

    updatePageResizer: function()
    {
        // TODO(dgozman): remove once we switch over.
    },

    _updateUI: function()
    {
        if (!this.isShowing())
            return;

        var zoomFactor = WebInspector.zoomManager.zoomFactor();

        var cssScreenRect = this._model.screenRect().scale(1 / zoomFactor);
        var cssVisiblePageRect = this._model.visiblePageRect().scale(1 / zoomFactor);
        var resizePagePlaceholder = false;

        if (!cssScreenRect.isEqual(this._cachedCssScreenRect)) {
            this._screenArea.style.left = cssScreenRect.left + "px";
            this._screenArea.style.top = cssScreenRect.top + "px";
            this._screenArea.style.width = cssScreenRect.width + "px";
            this._screenArea.style.height = cssScreenRect.height + "px";
            resizePagePlaceholder = true;
        }

        if (!cssVisiblePageRect.isEqual(this._cachedCssVisiblePageRect)) {
            this._pageArea.style.left = cssVisiblePageRect.left + "px";
            this._pageArea.style.top = cssVisiblePageRect.top + "px";
            this._pageArea.style.width = cssVisiblePageRect.width + "px";
            this._pageArea.style.height = cssVisiblePageRect.height + "px";
            resizePagePlaceholder = true;
        }

        if (this._model.type() !== this._cachedModelType) {
            var isDevice = this._model.type() === WebInspector.DeviceModeModel.Type.Device;
            this._resizerElement.classList.toggle("hidden", isDevice);
            this._genericWidthItem.setVisible(!isDevice);
            this._deviceSizeItem.setVisible(isDevice);
        }

        var warning = this._model.warning();
        if (warning !== this._cachedWarning) {
            this._warningMessage.textContent = warning;
            this._warningInfobar.setVisible(!!warning);
        }

        if (this._model.type() === WebInspector.DeviceModeModel.Type.Device) {
            var deviceSize = this._model.appliedDeviceSize();
            this._deviceSizeInput.value = deviceSize.width + "x" + deviceSize.height;
        }
        this._loadScreenImage(this._model.screenImage());
        if (resizePagePlaceholder)
            this._inspectedPagePlaceholder.onResize();
        this._mediaInspector.setAxisTransform(-cssScreenRect.left, this._model.fitScale());

        this._cachedCssScreenRect = cssScreenRect;
        this._cachedCssVisiblePageRect = cssVisiblePageRect;
        this._cachedModelType = this._model.type();
        this._cachedWarning = warning;
    },

    /**
     * @param {string} srcset
     */
    _loadScreenImage: function(srcset)
    {
        if (this._screenImage.getAttribute("srcset") === srcset)
            return;
        this._screenImage.setAttribute("srcset", srcset);
        if (!srcset)
            this._screenImage.classList.toggle("hidden", true);
    },

    /**
     * @param {boolean} success
     */
    _onScreenImageLoaded: function(success)
    {
        this._screenImage.classList.toggle("hidden", !success);
    },

    /**
     * @override
     */
    onResize: function()
    {
        var zoomFactor = WebInspector.zoomManager.zoomFactor();
        var rect = this._contentArea.getBoundingClientRect();
        this._model.availableSizeChanged(new Size(Math.max(rect.width * zoomFactor, 1), Math.max(rect.height * zoomFactor, 1)));
    },

    /**
     * @override
     */
    wasShown: function()
    {
        this._mediaInspector.setEnabled(true);
    },

    /**
     * @override
     */
    willHide: function()
    {
        this._mediaInspector.setEnabled(false);
    },

    __proto__: WebInspector.VBox.prototype
}


/**
 * @param {!WebInspector.MediaQueryInspector} mediaInspector
 * @param {!Element} container
 * @param {function()} resizeCallback
 * @constructor
 */
WebInspector.DeviceModeView.MediaInspectorButton = function(mediaInspector, container, resizeCallback)
{
    this._mediaInspector = mediaInspector;
    this._mediaInspector.addEventListener(WebInspector.MediaQueryInspector.Events.CountUpdated, this._updateButton, this);
    this._mediaInspector.addEventListener(WebInspector.MediaQueryInspector.Events.HeightUpdated, resizeCallback);

    this._resizeCallback = resizeCallback;
    this._container = container;

    this._setting = WebInspector.settings.createSetting("showMediaQueryInspector", false);
    this._setting.addChangeListener(this._settingChanged, this);

    this._button = new WebInspector.ToolbarButton(WebInspector.UIString("Media queries not found"), "waterfall-toolbar-item");
    this._button.setToggled(this._setting.get());
    this._button.setEnabled(false);
    this._button.addEventListener("click", this._buttonClick, this);

    this._updateMediaInspector();
}

WebInspector.DeviceModeView.MediaInspectorButton.prototype = {
    /**
     * @return {!WebInspector.ToolbarButton}
     */
    button: function()
    {
        return this._button;
    },

    _settingChanged: function()
    {
        this._updateMediaInspector();
        this._resizeCallback.call(null);
    },

    _buttonClick: function()
    {
        this._setting.set(!this._button.toggled());
    },

    _updateMediaInspector: function()
    {
        var show = this._setting.get();
        this._button.setToggled(show);
        if (this._mediaInspector.isShowing() && !show)
            this._mediaInspector.detach();
        if (!this._mediaInspector.isShowing() && show)
            this._mediaInspector.show(this._container);
    },

    /**
     * @param {!WebInspector.Event} event
     */
    _updateButton: function(event)
    {
        var count = /** @type {number} */ (event.data);
        this._button.setEnabled(!!count);
        if (!count)
            this._button.setTitle(WebInspector.UIString("Media queries not found"));
        else
            this._button.setTitle(WebInspector.UIString((count === 1 ? "%d media query found" : "%d media queries found"), count));
    }
}

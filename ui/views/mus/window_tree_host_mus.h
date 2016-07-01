// Copyright 2015 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef UI_VIEWS_MUS_WINDOW_TREE_HOST_MUS_H_
#define UI_VIEWS_MUS_WINDOW_TREE_HOST_MUS_H_

#include "base/macros.h"
#include "components/mus/public/interfaces/window_tree.mojom.h"
#include "ui/aura/window_tree_host_platform.h"

class SkBitmap;

namespace mojo {
class Shell;
}

namespace mus {
class Window;
}

namespace ui {
class Compositor;
}

namespace views {

class InputMethodMUS;
class NativeWidgetMus;
class PlatformWindowMus;
class SurfaceContextFactory;

class WindowTreeHostMus : public aura::WindowTreeHostPlatform {
 public:
  WindowTreeHostMus(mojo::Shell* shell,
                    NativeWidgetMus* native_widget_,
                    mus::Window* window,
                    mus::mojom::SurfaceType surface_type);
  ~WindowTreeHostMus() override;

  PlatformWindowMus* platform_window();
  ui::PlatformWindowState show_state() const { return show_state_; }

 private:
  // aura::WindowTreeHostPlatform:
  void DispatchEvent(ui::Event* event) override;
  void OnClosed() override;
  void OnWindowStateChanged(ui::PlatformWindowState new_state) override;
  void OnActivationChanged(bool active) override;

  NativeWidgetMus* native_widget_;
  scoped_ptr<InputMethodMUS> input_method_;
  scoped_ptr<SurfaceContextFactory> context_factory_;
  ui::PlatformWindowState show_state_;

  DISALLOW_COPY_AND_ASSIGN(WindowTreeHostMus);
};

}  // namespace views

#endif  // UI_VIEWS_MUS_WINDOW_TREE_HOST_MUS_H_

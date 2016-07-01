// Copyright 2015 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "components/content_settings/core/browser/website_settings_info.h"

#include "base/logging.h"
#include "base/prefs/pref_registry.h"
#include "base/strings/string_util.h"
#include "base/values.h"
#include "components/pref_registry/pref_registry_syncable.h"

namespace {

const char kPrefPrefix[] = "profile.content_settings.exceptions.";
const char kDefaultPrefPrefix[] = "profile.default_content_setting_values.";

std::string GetPrefName(const std::string& name, const char* prefix) {
  std::string pref_name = name;
  base::ReplaceChars(pref_name, "-", "_", &pref_name);
  return std::string(prefix).append(pref_name);
}

}  // namespace

namespace content_settings {

WebsiteSettingsInfo::WebsiteSettingsInfo(
    ContentSettingsType type,
    const std::string& name,
    scoped_ptr<base::Value> initial_default_value,
    SyncStatus sync_status,
    LossyStatus lossy_status)
    : type_(type),
      name_(name),
      pref_name_(GetPrefName(name, kPrefPrefix)),
      default_value_pref_name_(GetPrefName(name, kDefaultPrefPrefix)),
      initial_default_value_(initial_default_value.Pass()),
      sync_status_(sync_status),
      lossy_status_(lossy_status) {
  // For legacy reasons the default value is currently restricted to be an int.
  // TODO(raymes): We should migrate the underlying pref to be a dictionary
  // rather than an int.
  DCHECK(!initial_default_value_ ||
         initial_default_value_->IsType(base::Value::TYPE_INTEGER));
}

WebsiteSettingsInfo::~WebsiteSettingsInfo() {}

uint32 WebsiteSettingsInfo::GetPrefRegistrationFlags() const {
  uint32 flags = PrefRegistry::NO_REGISTRATION_FLAGS;

  if (sync_status_ == SYNCABLE)
    flags |= user_prefs::PrefRegistrySyncable::SYNCABLE_PREF;

  if (lossy_status_ == LOSSY)
    flags |= PrefRegistry::LOSSY_PREF;

  return flags;
}

}  // namespace content_settings
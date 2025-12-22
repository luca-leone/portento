# frozen_string_literal: true

# XcodeArchiveConfig.rb
# Visma CLI service for managing Xcode scheme archive build configurations
# Part of the InSchool Mobile build automation pipeline

VALID_CONFIGURATIONS = %w[Debug Release].freeze
ARCHIVE_ACTION_PATTERN = /(<ArchiveAction[^>]*?buildConfiguration\s*=\s*['"])([^'"]+)(['"][^>]*?>)/m.freeze
ARCHIVE_ELEMENT_PATTERN = /(<ArchiveAction(?![^>]*buildConfiguration)[^>]*?)(>)/m.freeze
APS_ENVIRONMENT_PATTERN = /(<key>aps-environment<\/key>\s*<string>)([^<]+)(<\/string>)/m.freeze

# Pattern to match all action types with buildConfiguration
ALL_ACTIONS_PATTERN = /(\s+buildConfiguration\s*=\s*['"])([^'"]+)(['"])/m.freeze

def log_info(message)
  puts "ℹ️  #{message}"
end

def log_success(message)
  puts "✅ #{message}"
end

def log_error(message)
  puts "❌ #{message}"
end

def log_warning(message)
  puts "⚠️  #{message}"
end

def log_info(message)
  puts "ℹ️  #{message}"
end

def log_success(message)
  puts "✅ #{message}"
end

def log_error(message)
  puts "❌ #{message}"
end

def print_usage
  puts <<~USAGE
    Usage: ruby XcodeArchiveConfig.rb <scheme_path> <build_configuration>
    
    Arguments:
      scheme_path          Path to the .xcscheme file
      build_configuration  'Debug' or 'Release'
    
    Example:
      ruby XcodeArchiveConfig.rb ios/InSchool.xcodeproj/xcshareddata/xcschemes/InSchool.xcscheme Release
    
    Part of Visma CLI build automation for InSchool Mobile
  USAGE
end

def validate_arguments!(scheme_path, build_configuration)
  if scheme_path.nil? || build_configuration.nil?
    print_usage
    exit 1
  end

  unless VALID_CONFIGURATIONS.include?(build_configuration)
    log_error "build_configuration must be one of: #{VALID_CONFIGURATIONS.join(', ')}"
    log_error "Received: '#{build_configuration}'"
    exit 1
  end

  unless File.exist?(scheme_path)
    log_error "Scheme file not found at #{scheme_path}"
    log_error "Current directory: #{Dir.pwd}"
    exit 1
  end

  unless File.readable?(scheme_path) && File.writable?(scheme_path)
    log_error "Scheme file is not readable/writable: #{scheme_path}"
    exit 1
  end
end

def clean_duplicate_build_configurations(content)
  # Remove any duplicate buildConfiguration attributes that might exist
  # This regex finds any Action elements with multiple buildConfiguration attributes
  duplicate_pattern = /((?:Test|Launch|Profile|Analyze|Archive)Action[^>]*?buildConfiguration\s*=\s*['"][^'"]+['"][^>]*?)(\s+buildConfiguration\s*=\s*['"][^'"]+['"])/m
  
  cleaned_content = content
  match_count = 0
  
  while cleaned_content.match(duplicate_pattern)
    cleaned_content = cleaned_content.gsub(duplicate_pattern, '\1')
    match_count += 1
    break if match_count > 10 # Safety break to prevent infinite loop
  end
  
  if match_count > 0
    log_warning "Cleaned #{match_count} duplicate buildConfiguration attribute(s)"
  end
  
  cleaned_content
end

def update_all_build_configurations(content, build_configuration)
  # Update buildConfiguration for all action types to match
  # This ensures consistency across Test, Launch, Profile, Analyze, and Archive actions
  
  log_info "Updating ALL action buildConfigurations to: #{build_configuration}"
  
  changes_made = false
  updated_content = content.gsub(ALL_ACTIONS_PATTERN) do |match|
    old_config = $2
    
    if old_config != build_configuration
      log_info "  buildConfiguration: '#{old_config}' → '#{build_configuration}'"
      changes_made = true
    end
    
    "#{$1}#{build_configuration}#{$3}"
  end
  
  if !changes_made
    log_info "All buildConfigurations already set to '#{build_configuration}'"
  end
  
  updated_content
end

def get_entitlements_path(scheme_path)
  # Derive entitlements path from scheme path
  # ios/InSchool.xcodeproj/xcshareddata/xcschemes/InSchool.xcscheme
  # -> ios/InSchool/InSchool.entitlements
  scheme_dir = File.dirname(scheme_path)
  ios_dir = File.dirname(File.dirname(File.dirname(scheme_dir)))
  File.join(ios_dir, 'InSchool', 'InSchool.entitlements')
end

def update_entitlements(entitlements_path, build_configuration)
  unless File.exist?(entitlements_path)
    log_warning "Entitlements file not found at #{entitlements_path} - skipping"
    return true
  end

  unless File.readable?(entitlements_path) && File.writable?(entitlements_path)
    log_error "Entitlements file is not readable/writable: #{entitlements_path}"
    return false
  end

  log_info "Reading entitlements file: #{entitlements_path}"
  entitlements_content = File.read(entitlements_path)

  # Map build configuration to APNs environment
  aps_environment = build_configuration == 'Release' ? 'production' : 'development'
  
  match = entitlements_content.match(APS_ENVIRONMENT_PATTERN)
  
  unless match
    log_warning "aps-environment key not found in entitlements file - skipping"
    return true
  end

  current_environment = match[2]
  log_info "Current aps-environment: '#{current_environment}'"

  if current_environment == aps_environment
    log_info "aps-environment already set to '#{aps_environment}' - no changes needed"
    return true
  end

  log_info "Updating aps-environment from '#{current_environment}' to '#{aps_environment}'"
  
  updated_entitlements = entitlements_content.gsub(
    APS_ENVIRONMENT_PATTERN,
    "\\1#{aps_environment}\\3"
  )

  File.write(entitlements_path, updated_entitlements)
  log_success "Entitlements updated: aps-environment set to '#{aps_environment}'"
  true
rescue StandardError => e
  log_error "Failed to update entitlements: #{e.message}"
  false
end

def update_existing_configuration(file_content, match, build_configuration)
  old_config = match[2]
  log_info "Current buildConfiguration: '#{old_config}'"
  
  if old_config == build_configuration
    log_info "Configuration already set to '#{build_configuration}' - no changes needed"
    return nil
  end
  
  log_info "Updating buildConfiguration from '#{old_config}' to '#{build_configuration}'"
  file_content.gsub(ARCHIVE_ACTION_PATTERN, "\\1#{build_configuration}\\3")
end

def add_missing_configuration(file_content, build_configuration)
  archive_match = file_content.match(ARCHIVE_ELEMENT_PATTERN)
  
  unless archive_match
    log_error "ArchiveAction element not found in scheme file"
    exit 1
  end
  
  log_info "ArchiveAction found but missing buildConfiguration attribute"
  log_info "Adding buildConfiguration = '#{build_configuration}'"
  
  # Insert buildConfiguration attribute with proper Xcode formatting
  new_attributes = "\n      buildConfiguration = \"#{build_configuration}\""
  file_content.gsub(ARCHIVE_ELEMENT_PATTERN, "\\1#{new_attributes}\\2")
end

def update_scheme_configuration(file_content, build_configuration)
  # First, clean any duplicate buildConfiguration attributes
  cleaned_content = clean_duplicate_build_configurations(file_content)
  
  # Update ALL action buildConfigurations to be consistent
  updated_content = update_all_build_configurations(cleaned_content, build_configuration)
  
  # Check if any changes were made
  if updated_content == file_content
    log_info "All buildConfigurations already set to '#{build_configuration}' - no changes needed"
    return nil
  end
  
  updated_content
end

def process_archive_action(file_content, build_configuration)
  # Use the new unified function
  update_scheme_configuration(file_content, build_configuration)
end

def write_updated_file(scheme_path, content)
  File.write(scheme_path, content)
rescue Errno::EACCES => e
  log_error "Permission denied writing to scheme file: #{e.message}"
  exit 1
rescue StandardError => e
  log_error "Failed to write updated scheme file: #{e.message}"
  exit 1
end

# Main execution
scheme_path = ARGV[0]
build_configuration = ARGV[1]

begin
  validate_arguments!(scheme_path, build_configuration)
  
  log_info "Reading scheme file: #{scheme_path}"
  file_content = File.read(scheme_path)
  
  updated_content = update_scheme_configuration(file_content, build_configuration)
  
  # Handle no-change case for scheme
  scheme_updated = !updated_content.nil?
  
  if scheme_updated
    write_updated_file(scheme_path, updated_content)
    log_success "Scheme file updated successfully!"
  end
  
  # Update entitlements file
  entitlements_path = get_entitlements_path(scheme_path)
  entitlements_updated = update_entitlements(entitlements_path, build_configuration)
  
  if scheme_updated || entitlements_updated
    log_success "Configuration update completed!"
    log_success "Archive build configuration: '#{build_configuration}'"
    
    aps_env = build_configuration == 'Release' ? 'production' : 'development'
    log_success "APNs environment: '#{aps_env}'"
  else
    log_info "No changes needed - configuration already correct"
  end
  
rescue Errno::EACCES => e
  log_error "Permission denied: #{e.message}"
  exit 1
rescue Errno::ENOENT => e
  log_error "File not found: #{e.message}"
  exit 1
rescue StandardError => e
  log_error "Unexpected error: #{e.class} - #{e.message}"
  exit 1
end
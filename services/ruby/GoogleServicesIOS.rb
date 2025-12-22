require 'bundler/setup'
require 'xcodeproj'

# Arguments from your Node script: project_path, file_path_to_add, target_name
project_path = ARGV[0]
file_to_add = ARGV[1]
target_name = ARGV[2]
filename_to_remove = File.basename(file_to_add)

project = Xcodeproj::Project.open(project_path)
target = project.targets.find { |t| t.name == target_name }

# --- NEW: Cleanup Section ---
puts "Looking for existing references to #{filename_to_remove}..."

# Find all existing file references by name
existing_references = project.files.select { |file| file.path.end_with?(filename_to_remove) }

if existing_references.any?
  existing_references.each do |ref|
    puts "Found and removing old reference: #{ref.path}"
    # Remove from the target's resource build phase
    target.resources_build_phase.remove_file_reference(ref)
    # Remove from the project's file group structure
    ref.remove_from_project
  end
else
  puts "No old references found."
end
# --- End of Cleanup Section ---

# Find the main group (usually named after the target) to add the new file to
main_group = project.main_group.find_subpath(target_name, true)

# Add the new file reference
puts "Adding new reference for: #{file_to_add}"
file_ref = main_group.new_file(file_to_add)
target.add_file_references([file_ref])

project.save
puts "Project saved successfully."
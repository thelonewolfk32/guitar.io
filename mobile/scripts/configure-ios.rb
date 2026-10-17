require 'xcodeproj'
require 'fileutils'
require 'pathname'
root=File.expand_path('..',__dir__)
project=Xcodeproj::Project.open(File.join(root,'ios/GuitarIO.xcodeproj'))
app=project.targets.find{|t|t.name=='GuitarIO'}
group=project.main_group.find_subpath('GuitarIO',false) || project.main_group
%w[GuitarLocal.swift GuitarPlatform.swift GuitarModules.m].each do |name|
 ref=project.files.find{|f|f.path=="GuitarIO/#{name}"} || group.new_file("GuitarIO/#{name}")
 app.source_build_phase.add_file_reference(ref,true)
end
%w[legacy-migrate.js PrivacyInfo.xcprivacy].each do |name|
 ref=project.files.find{|f|f.path=="GuitarIO/#{name}"} || group.new_file("GuitarIO/#{name}")
 app.resources_build_phase.add_file_reference(ref,true)
end
ref=project.files.find{|f|f.path=='ScoreWeb'} || project.main_group.new_file('ScoreWeb')
ref.last_known_file_type='folder'
app.resources_build_phase.add_file_reference(ref,true)
extension=project.targets.find{|t|t.name=='GuitarShare'} || project.new_target(:app_extension,'GuitarShare',:ios,'16.0')
ref=project.files.find{|f|f.path=='ShareExtension/ShareViewController.swift'} || project.main_group.new_file('ShareExtension/ShareViewController.swift')
extension.source_build_phase.add_file_reference(ref,true)
app.add_dependency(extension) unless app.dependencies.any?{|d|d.target==extension}
embed=app.copy_files_build_phases.find{|p|p.name=='Embed App Extensions'} || app.new_copy_files_build_phase('Embed App Extensions')
embed.dst_subfolder_spec='13'
embed.add_file_reference(extension.product_reference,true).settings={'ATTRIBUTES'=>['RemoveHeadersOnCopy']}
team=ENV['APPLE_TEAM_ID']
[app,extension].each do |target|
 target.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER']=target==app ? 'io.guitario.mobile' : 'io.guitario.mobile.share'
  config.build_settings['CODE_SIGN_ENTITLEMENTS']='GuitarIO/GuitarIO.entitlements'
  config.build_settings['SWIFT_VERSION']='5.0'
  config.build_settings['MARKETING_VERSION']='1.6.0'
  config.build_settings['CURRENT_PROJECT_VERSION']='160'
  config.build_settings['DEVELOPMENT_TEAM']=team if team && !team.empty?
  config.build_settings['INFOPLIST_FILE']=target==app ? 'GuitarIO/Info.plist' : 'ShareExtension/Info.plist'
  config.build_settings['SKIP_INSTALL']='YES' if target==extension
  config.build_settings['APPLICATION_EXTENSION_API_ONLY']='YES' if target==extension
 end
end
project.save
puts 'Configured GuitarIO, native bridges, bundled score engine and Share Extension.'

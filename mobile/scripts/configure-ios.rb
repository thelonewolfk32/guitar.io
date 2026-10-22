require 'xcodeproj'
require 'fileutils'
require 'pathname'
require 'optparse'
profile='local'
OptionParser.new do |options|
 options.on('--profile PROFILE', %w[local full], 'local: Personal Team; full: paid Apple capabilities'){|value|profile=value}
end.parse!
abort 'Unexpected arguments' unless ARGV.empty?
root=File.expand_path('..',__dir__)
project=Xcodeproj::Project.open(File.join(root,'ios/GuitarIO.xcodeproj'))
app=project.targets.find{|t|t.name=='GuitarIO'}
group=project.main_group.find_subpath('GuitarIO',false) || project.main_group
%w[GuitarLocal.swift GuitarPlatform.swift GuitarAuth.swift GuitarModules.m].each do |name|
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
extension=project.targets.find{|t|t.name=='GuitarShare'}
if profile=='local'
 app.dependencies.select{|d|d.target==extension}.each(&:remove_from_project) if extension
 app.copy_files_build_phases.select{|p|p.name=='Embed App Extensions'}.each(&:remove_from_project)
 project.root_object.attributes.fetch('TargetAttributes',{}).delete(extension.uuid) if extension
 extension.remove_from_project if extension
 extension=nil
else
extension ||= project.new_target(:app_extension,'GuitarShare',:ios,'16.0')
ref=project.files.find{|f|f.path=='ShareExtension/ShareViewController.swift'} || project.main_group.new_file('ShareExtension/ShareViewController.swift')
extension.source_build_phase.add_file_reference(ref,true)
app.add_dependency(extension) unless app.dependencies.any?{|d|d.target==extension}
embed=app.copy_files_build_phases.find{|p|p.name=='Embed App Extensions'} || app.new_copy_files_build_phase('Embed App Extensions')
embed.dst_subfolder_spec='13'
embed.add_file_reference(extension.product_reference,true).settings={'ATTRIBUTES'=>['RemoveHeadersOnCopy']}
end
team=ENV['APPLE_TEAM_ID']
[app,extension].compact.each do |target|
 target.build_configurations.each do |config|
  config.build_settings['PRODUCT_NAME']=target.name
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER']=target==app ? 'io.guitario.mobile' : 'io.guitario.mobile.share'
  config.build_settings['CODE_SIGN_ENTITLEMENTS']=target==extension ? 'ShareExtension/GuitarShare.entitlements' : "GuitarIO/GuitarIO.#{profile}.entitlements"
  config.build_settings['CODE_SIGN_STYLE']='Automatic'
  config.build_settings['GUITARIO_BUILD_PROFILE']=profile
  config.build_settings['SWIFT_VERSION']='5.0'
  config.build_settings['MARKETING_VERSION']='1.6.0'
  config.build_settings['CURRENT_PROJECT_VERSION']='160'
  config.build_settings['DEVELOPMENT_TEAM']=team if team && !team.empty?
  config.build_settings['INFOPLIST_FILE']=target==app ? 'GuitarIO/Info.plist' : 'ShareExtension/Info.plist'
  config.build_settings['SKIP_INSTALL']='YES' if target==extension
  config.build_settings['APPLICATION_EXTENSION_API_ONLY']='YES' if target==extension
 end
end
info_path=File.join(root,'ios/GuitarIO/Info.plist')
info=Xcodeproj::Plist.read_from_path(info_path)
info['GuitarBuildProfile']=profile
info['GuitarShareInboxEnabled']=profile=='full'
info['GuitarAppleSignInEnabled']=profile=='full'
info['GuitarPurchasesEnabled']=profile=='full'
info['CFBundleURLTypes']=[{'CFBundleURLName'=>'io.guitario.mobile.auth','CFBundleURLSchemes'=>['io.guitario.mobile.auth']}]
google_id=ENV['GOOGLE_IOS_CLIENT_ID'].to_s
server_id=ENV['GOOGLE_WEB_CLIENT_ID'].to_s
if !google_id.empty? || !server_id.empty?
 abort 'Supply both GOOGLE_IOS_CLIENT_ID and GOOGLE_WEB_CLIENT_ID' if google_id.empty? || server_id.empty?
 abort 'Invalid Google client ID' unless [google_id,server_id].all?{|id|id.match?(/\A[a-zA-Z0-9.-]+\.apps\.googleusercontent\.com\z/)}
 info['GIDClientID']=google_id
 info['GIDServerClientID']=server_id
end
if info['GIDClientID']
 info['CFBundleURLTypes'] << {'CFBundleURLName'=>'Google','CFBundleURLSchemes'=>[info['GIDClientID'].split('.').reverse.join('.')]}
end
Xcodeproj::Plist.write_to_path(info,info_path)
attributes=project.root_object.attributes['TargetAttributes'] ||= {}
attributes[app.uuid] ||= {}
attributes[app.uuid]['SystemCapabilities']={'com.apple.ApplicationGroups.iOS'=>{'enabled'=>profile=='full' ? 1 : 0},'com.apple.SignInWithApple'=>{'enabled'=>profile=='full' ? 1 : 0}}
project.save
puts "Configured GuitarIO #{profile}: Share Extension/App Group/Apple login/purchases #{profile=='full' ? 'enabled' : 'excluded'}. Bundle ID unchanged."

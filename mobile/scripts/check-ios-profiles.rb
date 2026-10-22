require 'xcodeproj'
require 'rbconfig'
Dir.chdir(File.expand_path('..',__dir__)) do
 %w[local full full local local].each do |profile|
  abort 'Configuration failed' unless system(RbConfig.ruby,'scripts/configure-ios.rb','--profile',profile)
  project=Xcodeproj::Project.open('ios/GuitarIO.xcodeproj');app=project.targets.find{|t|t.name=='GuitarIO'}
  share=project.targets.find{|t|t.name=='GuitarShare'};full=profile=='full'
  abort 'Incorrect extension profile' unless !share.nil? == full
  abort 'App identity changed' unless app.build_configurations.all?{|c|c.build_settings['PRODUCT_BUNDLE_IDENTIFIER']=='io.guitario.mobile'}
  abort 'Incorrect entitlements' unless app.build_configurations.all?{|c|c.build_settings['CODE_SIGN_ENTITLEMENTS']=="GuitarIO/GuitarIO.#{profile}.entitlements"}
  info=Xcodeproj::Plist.read_from_path('ios/GuitarIO/Info.plist')
  abort 'Incorrect capability export' unless %w[GuitarShareInboxEnabled GuitarAppleSignInEnabled GuitarPurchasesEnabled].all?{|k|info[k]==full}
  abort 'Extension dependency incorrect' unless app.dependencies.count{|d|d.target&.name=='GuitarShare'}==(full ? 1 : 0)
  abort 'Embedded extension incorrect' unless app.copy_files_build_phases.count{|p|p.name=='Embed App Extensions'}==(full ? 1 : 0)
 end
end
puts 'PASS local/full/idempotent profile transitions and unchanged app identity.'

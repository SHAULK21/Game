{{flutter_js}}
{{flutter_build_config}}

// One lazily loaded engine survives tab changes; views are attached by React.
const root = new URL('./', document.currentScript.src).href;
const config = {entrypointBaseUrl: root, assetBase: root, canvasKitBaseUrl: root + 'canvaskit/', fontFallbackBaseUrl: root + 'fonts/'};
_flutter.loader.load({
  config,
  onEntrypointLoaded: async function(initializer) {
    try {
      const runner = await initializer.initializeEngine({
        ...config,
        multiViewEnabled: true,
      });
      const app = await runner.runApp();
      window.aethelgardFlutterReady(app);
    } catch (error) {window.aethelgardFlutterFailed(error);}
  },
}).catch(error => window.aethelgardFlutterFailed(error));

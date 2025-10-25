(async () => {
  async function go() {
    let version = 3.028;
    const {golgi} = await import(window.location.origin + '/js/golgi.min.js?version=' + version);

    let context = {
      assemblyPath: window.location.origin + '/js/assemblies/',
      componentPaths: {
        sbadmin: window.location.origin + '/js/components/sbadmin/'
      },
      version: version,
      Chart: Chart,
      request: async (url, method, body) => {
        url = window.location.origin + url;
        method = method || 'GET';
        let options = {
          method: method,
          headers: {
            'Content-type': 'application/json'
          }
        };
        if (body) {
          options.body = JSON.stringify(body);
        }
        try {
          let res = await fetch(url, options);
          return await res.json();
        }
        catch(err) {
          console.log(err);
          return {
            error: 'Fetch failed',
            err: err
          }
        }
      }
    };
    golgi.logging = true;
    let rootComponent = await golgi.renderAssembly('root_assembly', 'body', context);

    // pre-load components that are needed later while things are quiet...

    setTimeout(async function() {
      let arr = ['sbadmin-select', 'sbadmin-modal', 'sbadmin-table'];
      for (let name of arr) {
        let _module = await import(context.componentPaths.sbadmin + name + '.js?version=' + version);
        _module.load();
      }
    }, 500);

  }

  document.addEventListener('DOMContentLoaded', function() {
    // wait for all defered scripts to load, so everything needed to get going in ready
    go();
  });

})();

export function createGpuTimer(gl:WebGL2RenderingContext) {
  const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2') as {TIME_ELAPSED_EXT:number;GPU_DISJOINT_EXT:number}|null;
  let pending:WebGLQuery|null=null;
  return {
    measure(draw:()=>void):number|null {
      if(!ext) {draw();return null;}
      let result:number|null=null;
      if(pending && gl.getQueryParameter(pending,gl.QUERY_RESULT_AVAILABLE)) {
        if(!gl.getParameter(ext.GPU_DISJOINT_EXT)) result=Number(gl.getQueryParameter(pending,gl.QUERY_RESULT))/1e6;
        gl.deleteQuery(pending);pending=null;
      }
      const query=pending?null:gl.createQuery();
      if(query) gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
      try {draw();}
      finally {if(query) {gl.endQuery(ext.TIME_ELAPSED_EXT);pending=query;}}
      return result;
    },
    dispose(){if(pending)gl.deleteQuery(pending);pending=null;},
  };
}

import React, { useState, useEffect } from 'react';

import AsciiTerminal from './visuals/consoleRender';

const App: React.FC = () => {
return(
  
  <div className="h-screen bg-black flex items-center justify-center">
    
    <AsciiTerminal/>
  </div>
)
};

export default App;
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
type Theme='light'|'dark';
const ThemeContext=createContext<{theme:Theme;toggle:()=>void}|null>(null);
export function ThemeProvider({children}:{children:ReactNode}){
 const [theme,setTheme]=useState<Theme>(()=>{try{const saved=localStorage.getItem('foh-theme');if(saved==='light'||saved==='dark')return saved;}catch{}return window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'});
 useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem('foh-theme',theme)}catch{}},[theme]);
 return <ThemeContext.Provider value={{theme,toggle:()=>setTheme(t=>t==='light'?'dark':'light')}}>{children}</ThemeContext.Provider>;
}
export function useTheme(){const c=useContext(ThemeContext);if(!c)throw new Error('ThemeProvider missing');return c;}

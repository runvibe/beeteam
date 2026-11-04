import { useEffect, useRef } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
export function DetailInfoButton({label,screen,mobile,onOpen}:{label:string;screen:boolean;mobile:boolean;onOpen:()=>void}) {
 const trigger=useRef<HTMLButtonElement>(null), previous=useRef(screen);
 useEffect(()=>{if(previous.current&&!screen&&mobile)trigger.current?.focus({preventScroll:true});previous.current=screen;},[screen,mobile]);
 return <Button ref={trigger} className="detail-info-button" variant="outline" size="icon" aria-label={label} title={label} hidden={screen||!mobile} onClick={onOpen}><Info aria-hidden="true" /></Button>;
}

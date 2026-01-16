"use client";

const BASE64_IMAGE = "data:image/png;base64,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";

const ASCII_TEXT = `                                                                                
                                                                                
                                                                                
                             .\`l++>,'.     .'I+?~:.                             
                         ''l+lcOLUYCv<'   .(xruYQO?ii\`.                         
                       .;0MqW@$#f_-fh#>. ^X*C1-?QB$WZhh/\`.                      
                      'zB#h$&zf[.  :0@Q'./BM+   I|tk$bp%&l                      
                    ^1a$Q]0d$$$$$MmL@$oi'X$$bO#$$$$$@0J)&@nI.                   
                  '(W$$$MC@$$$8wcxcq%$$?:w$$*JxxCo$$$$#w$$$@Y;.                 
                 'YoXqC<:h$@qbbaY^[qak$-,O$aqX'{ZvqL%$B]l[wUOhi                 
                'zX8$$@@L^}YBY\\$$Y'k$$B-;d$$$!+%$W~#o_"<MWB$@0r>'               
               '(%$$WUBWdX%$$@@&$W<~%$8+\`C$$C^J$W&Wb$$dU#Bb*$@$z".              
              \`L$@%ML@*%$$$$$@oC:''_@$$?:b$$f',:)OB$$$$$$hBhp%B$hl.             
             \`QWoMvt$$$$$$$$*ahuoW%@@$$-\`J$$$B8WYc#k@$$@$$$$qvWhoo>.            
             }z8$$&p$$@$$$@o8$d:fWB$$$@[;b$$$@%wI_$@xB$$$$$$Mp$@BLf\`            
             -W$$M\`^LwB@r>ZW$$$oQu\\j%8B?:q$MU[|zw8$$$cY~M$Ld_\`v@$@u'            
            "*$od$*8$@@$BIXh$@$@$@B$$$k!.\\B$@@@$$$$@$J-z$$$$%h@%p$@1.           
           't$&nB$$$$@a@$_LJd$@B|>rw@$$]"m@$hU]iLaB@X#_k$$W$$$$$dw$@I.          
          .(]+?B$$@$$WB$$b:ivk@$$$$$$$$1iM$$$$$$$$#m[,X@$$p$$$$@$zZ|)"          
          :w@*0$$$@Q(OC$$$$$$$$$BM#%B$$?Ih$$@&#WB$$$@$$$$8nZj@@$@*Q$8].         
         ,o$$#Z$B$$$*~XYB$$@$$$@$Wb%$@wI'\\MW$%pW$@$$$$$$hq_w$$$$@Md$$@)'        
        ^m$$$%\\xcB$$$$B*z%$$$$$$$$$$$$hl.x@$$$$$$$$$$@$Zb@$$$$$*X-O$$$M+.       
        ?WB@pdM&YB$$$$$@Q<|)uM$$$$@$$$$}:p$$$$$$$$BZ}r|1*$$$$@$d#Mdz@&$n'       
       .)w*O@@$WtwB$$@X$$$J\`j8&(M$$$$@$|i&$$$$$$Yb@8)[8$$m#$$$@]L$$$OdQc'       
       .>|r@$$@$$ko$$@$$$$$$b1!nm&8$$$$}iW$$$@onq~?Y@$$$$@BB$$YB$@$$$w}!.       
         ?$$B$$$$c$$$$$$$$$$$$$MX&$$$$$?:p@$$$$@M$$$$$$$$$$$$$&&$$$B$$O\`        
        "t$$w$$$$C$$$$$$#$$$$$$$$$$$$$bI.z$$$$$$$$$$$$$#@$@$@$8&$$@*8$ai'       
       'mbOWb$$$$zW$$$$@$LB$$@$$$$@@pJI''\`~U%$$$$$$$$@U&$$$$$$)%$@$$kht@~       
       _@ZY\\b$$$$$kdoWoQo@p|#o&$$$@$$$$?^L$$$$$$$$*aUuB8J*#Wbm$$$$$@)ct&Z.      
       1X#$&v$$$$$$$8Z@$$$%J%@oQ@$$@$$$j!W$$$$$$#O@$$$$$$$ka$$$$$$$%q$&nX'      
       \`a$$@Ob$$$@$$B@$$$$$$$$$@n$$$$$$z>%$@$@$**$$$$$$$$$@8$$$$$$@f%$@B+       
       !$$$$Bjh$$$$$$@$$$$$$$$$$o$$$$$$\${iM$$$$@@M@@$$$$$$$@$$$$$$BU&$$$$C.      
       I@@@$@$k/#B$$$$$$@*$$@$$$$$$$$$*i'c$@$$$$@$$$$$8%$$$$$$@8L/%$$$B@n.      
       .md$$$$$@*tC8$8mZX#q*@$$@$$$$$#t''"b$$$$$@$$$@LdqUw#@BdjZ@@$$$$&h>       
        -c$$$$@$$mWO*B$$@$$bW$@$$@$$$$*i'c$@$$$@$$$$Y@$$$$B8OWq&$$$$$$d]'       
        ."M$$$$$hB$@$$$$$$$$bW$$$$$$$$\${Ih$$$$$$@$$b8$$$$$$$$$$*@$$$$$?.'       
         "/q@h8$$$$$$$$$$$$$@%L&&B@$$$$)iM$$$$@%8kq@$$$$$$$$$$$$$@w%#|t'        
         !@&ocO$$$$$@$$$@$$$$$$oB$$$$$8+\`L$$$@$@#@$@$$$$$$$@$@$$$#rZb&w'        
         ^ko$Wb0@$$$$%MkwO%$$$$$$$$$$@Z>^j8$$$$$@$$$$$Ombo8@$@$$hZqMBb]'        
         .lp$@$8Ud$$$$$$$Wh$$$$$$$$$a#$(!W%@$$$$$$$$$ob@$$$$$$Bz*$$$&_'         
          .}B$@$$$Ba*@$$$$o*$$$$$$$$$$$]Ih$$$$$$$$$$BL@$$@$8oW@$@$$$v'          
           .^q@$$$$@Y@$$$$$%L&$@@$$$$$m:'tB$$$$$$$Bb0$$$$$$oo@$$$$&].           
             ^n@$$@$&mB$$$$$$WZqQqkpdpLl'/mhwbbOZwh@$$$$$$oh$$$$$qi'            
              -dk*p@$@aZ%@$@$$$@$B%@@$$-:w$$@BBB@$$$$@$@qq8$$&WOOL^             
              'J@$&n@$$$BXr%@$$$$$$$$$W~\`J$$$@$$$$$$@0/#$$$$pm$$Bl.             
               \`j%$$8w&@$&k@#wZ*@@$$$$k>^n@$$$$$%dOhB%W$B%da@$$Zl               
                '^vd@@$$$@p*$$$$$$$$$w*-^0OM$$$$$$$$@m&$$$$@wU~.                
                  ']qUk$$$$#Um$$$$$kOBb;'u$kJ@$$$@&CpB$$@arLv:.                 
                   .^x%&h0w@$@%#a#B@$B\\"'jq$$B&*o8B$$oUqW%OI..                  
                      .^<nB%Xa@$$$@%Z0". .}O#$$$$$8mb@d~,.                      
                         '<zk%bqpwOw]'     >mwqkbhW#L_,.                        
                            .^<[{{?!'.      ..;+][+:..                           
                                                                                
                                                                                
                                                                                
`;

export default function AsciiBrain() {
  return (
    <div className="w-full h-[500px] bg-black">
      <div style={{ position: "relative", overflow: "hidden", borderRadius: "0px", width: "100%", height: "100%" }}>
        {/* Blurred background layer */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            filter: "blur(30px)",
            width: "fit-content",
            height: "fit-content",
            color: "transparent",
            userSelect: "none",
            whiteSpace: "pre",
            textAlign: "center",
            transformOrigin: "center center",
            fontVariantNumeric: "tabular-nums",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%) scale(0.5)",
            backgroundImage: `url("${BASE64_IMAGE}")`,
            backgroundRepeat: "no-repeat",
            backgroundSize: "100% 100%",
            imageRendering: "pixelated",
            backgroundClip: "text",
            fontFamily: '"Geist Mono", monospace',
            fontSize: "16px",
            fontStyle: "normal",
            fontWeight: "400",
            letterSpacing: "0em",
            lineHeight: "1em",
            opacity: "1",
          }}
        >
          {ASCII_TEXT}
        </div>
        
        {/* Sharp foreground layer */}
        <div
          aria-label=""
          style={{
            width: "fit-content",
            height: "fit-content",
            color: "transparent",
            userSelect: "none",
            whiteSpace: "pre",
            textAlign: "center",
            transformOrigin: "center center",
            fontVariantNumeric: "tabular-nums",
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%) scale(0.5)",
            backgroundImage: `url("${BASE64_IMAGE}")`,
            backgroundRepeat: "no-repeat",
            backgroundSize: "100% 100%",
            imageRendering: "pixelated",
            backgroundClip: "text",
            fontFamily: '"Geist Mono", monospace',
            fontSize: "16px",
            fontStyle: "normal",
            fontWeight: "400",
            letterSpacing: "0em",
            lineHeight: "1em",
          }}
        >
          {ASCII_TEXT}
        </div>
      </div>
    </div>
  );
}

import {Mesh} from "./Mesh.js";
import {Geometry} from "./Geometry.js";
import {Float32Attribute, Uint32Attribute} from "../core/BufferAttribute.js";
import {Vector2} from "../math/Vector2.js";
import {Vector3} from "../math/Vector3.js";
import { ZTextMaterial } from "../materials/ZTextMaterial.js";
import { ZTEXT_SPACE_SCREEN, ZTEXT_SPACE_WORLD } from "../constants.js";
import {roboto_font} from "../../examples/common/textures/fonts/roboto.js"

//ZText API
export class ZText extends Mesh{
    constructor(args = {}){
        super();
        this.type = "ZText";
        this.frustumCulled = false;
        this.pickable = true;
        this.screenW = args.screenW !== undefined ? args.screenW : 1425;
        this.screenH = args.screenH !== undefined ? args.screenH : 822;
        this.screenD = Math.sqrt(Math.pow(this.screenW, 2) + Math.pow(this.screenH, 2));

        this._text = args.text !== undefined ? args.text : "New text";
        this._fontTexture = args.fontTexture !== undefined ? args.fontTexture : null;
        this._xPos = args.xPos !== undefined ? (args.xPos*this.screenW) : 0;
        this._yPos = args.yPos !== undefined ? (args.yPos*this.screenH) : 0;
        this._cellAspect = args.cellAspect !== undefined ? args.cellAspect : 1;
        this._mode = args.mode !== undefined ? args.mode : ZTEXT_SPACE_SCREEN;
        this._fontHinting = 1.0;
        this._color = args.color !== undefined ? args.color : [0.0,0.0,0.0];
        this._font = args.font !== undefined ? args.font : roboto_font;
        this._sdf_tex_width = args.sdf_tex_width !== undefined ? args.sdf_tex_width : 0;
        this._sdf_tex_height = args.sdf_tex_height !== undefined ? args.sdf_tex_height : 0;

        this._finalOffsetX = 0;
        this._finalOffsetY = 0;

        //TODO refactor this
        if (this._mode === ZTEXT_SPACE_SCREEN){
            this._fontSize = args.fontSize !== undefined ? (args.fontSize*this.screenD) : 40;
            var font_metrics = ZText._fontMetrics( this._font, this._fontSize, this._fontSize * 0.2 );
            this.geometry = this.setText2D(this._text, this._xPos, this._yPos, font_metrics, this._font);
            this.material = new ZTextMaterial("ZText", {}, {"scale": ZText._setupScaleScreenMode(args.text, font_metrics, args.font)});
            // Uniforms aspect and viewport set by MeshRenderer based on actual viewport
            this.material.setUniform("MODE", ZTEXT_SPACE_SCREEN);
            this.material.setUniform("sdf_tex_width", this._sdf_tex_width);
            this.material.setUniform("sdf_tex_height", this._sdf_tex_height);
            this.material.setUniform("sdf_border_size", this._font.iy);
            this.material.setUniform("hint_amount", this._fontHinting);
            this.material.setUniform("offset", [0,0]);
            this.material.setUniform("FinalOffset", [0,0]);


            this.material.color = args.color;

            this.material.addMap(this._fontTexture);
        }else if (this._mode === ZTEXT_SPACE_WORLD){
            this._fontSize = args.fontSize !== undefined ? (args.fontSize*this.screenD) : 40;     
            this.geometry = ZText._assembleGeometry({text: this._text, fontSize: this._fontSize, font: this._font});
            this.material = ZText._assembleMaterial(
                {text: this._text, fontSize: this._fontSize, font: this._font,
                     cellAspect: this._cellAspect,
                      offset: new Vector2(this._xPos, this._yPos),
                        mode: this._mode,
                        fontHinting: this._fontHinting,
                 sdf_tex_width: this._sdf_tex_width,
                 sdf_tex_height: this._sdf_tex_height,
                 sdf_border_size: this._font.iy});
            this.material.color = args.color;
            this.material.addMap(this._fontTexture);
        }else {
            console.error('[' + this.type + "]: Unknow mode [" + args.mode + ']');
        }

        this.material.transparent = true;
    }

    set text(text){
        this._text = text;
        var font_metrics = ZText._fontMetrics( this._font, this._fontSize, this._fontSize * 0.2 );
        this.geometry = this.setText2D(this._text, this._xPos, this._yPos, font_metrics, this._font);
    }
    get text(){
        return this._text;
    }
    set fontTexture(fontTexture){
        this._fontTexture = fontTexture;
        this.material.clearMaps();
        this.material.addMap(this._fontTexture);
    }
    get fontTexture(){
        return this._fontTexture;
    }
    set xPos(xPos){
        this._xPos = xPos;
    }
    get xPos(){
        return this._xPos;
    }
    set yPos(yPos){
        this._yPos = yPos;
    }
    get yPos(){
        return this._yPos;
    }
    set fontSize(fontSize){
        this._fontSize = fontSize;
        var font_metrics = ZText._fontMetrics( this._font, this._fontSize, this._fontSize * 0.2 );
        this.geometry = this.setText2D(this._text, this._xPos, this._yPos, font_metrics, this._font);
        this.material.setAttribute("scale", ZText._setupScaleScreenMode(this._text, font_metrics, this._font));

    }
    get fontSize(){
        return this._fontSize;
    }

    setOffset(offset){
        this.material.setUniform("offset", offset);
    }

    setNewPositionOffset(x, y){
        this._finalOffsetX = this._finalOffsetX + x;
        this._finalOffsetY = this._finalOffsetY + y;
        this.material.setUniform("FinalOffset", [this._finalOffsetX, this._finalOffsetY]);
    }

    static _assembleGeometry(args){
        const geometry = new Geometry();
        var font_metrics = ZText._fontMetrics( args.font, args.fontSize, args.fontSize * 0.2 );
        geometry.vertices = ZText._setupVertices(args.text, font_metrics, args.font);
        geometry.indices = ZText._setupIndices(args.text, args.fontSize);
        geometry.uv = ZText._setupUVs(args.text, args.font);
        return geometry;
    }
    static _setupVertices(text, font_metrics, font){
        const textVertices = new Array(text.length * 4 * 2);
        var prev_char = " ";  // Used to calculate kerning
        var pos = [0,0];
        var cpos      = pos;  // Current pen position
        var x_max     = 0.0;  // Max width - used for bounding box
        var scale     = font_metrics.cap_scale;

        //FOR EVERY CHARACTER OF THE TEXT STRING
        for(let c = 0; c < text.length; c++){

            var schar = text.charAt(c);

            if ( schar == "\n" ) {
                if ( cpos[0] > x_max ) x_max = cpos[0]; // Expanding the bounding rect
                cpos[0]  = pos[0] ;                      
                cpos[1] -= font_metrics.line_height;
                prev_char = " ";
                continue;
            }
    
            if ( schar == " " ) {
                cpos[0] += font.space_advance * scale; 
                prev_char = " ";
                continue;
            }

            // Laying out the glyph rectangle
            var font_char = font.chars[schar];
            if ( !font_char ) {                         // Substituting unavailable characters with '?'
                font_char = font.chars[ "?" ];
            }

            var kern = font.kern[ prev_char + schar ];
            if ( !kern ) kern = 0.0;

            var baseline = cpos[1] - font_metrics.ascent;
            var lowcase = ( font.chars[schar].flags & 1 ) == 1;
            // Low case chars use their own scale
            var scale = lowcase ? font_metrics.low_scale : font_metrics.cap_scale;

            var g      = font_char.rect;
            var bottom = baseline - scale * ( font.descent + font.iy );
            var top    = bottom   + scale * ( font.row_height );
            var left   = cpos[0]   + font.aspect * scale * ( font_char.bearing_x + kern -  font.ix );
            
            var right  = left     + font.aspect * scale * ( g[2] - g[0] );
            var p = [ left, top, right, bottom ];

            textVertices[c*4*2 + 0] = p[0]; 
            textVertices[c*4*2 + 1] = p[1]; 

            textVertices[c*4*2 + 2] = p[0]; 
            textVertices[c*4*2 + 3] = p[3]; 

            textVertices[c*4*2 + 4] = p[2]; 
            textVertices[c*4*2 + 5] = p[1]; 

            textVertices[c*4*2 + 6] = p[2]; 
            textVertices[c*4*2 + 7] = p[3]; 
            
            // Advancing pen position
            var new_pos_x = cpos[0] + font.aspect * scale * ( font_char.advance_x  );
            cpos = [ new_pos_x, cpos[1] ];
            prev_char = schar;
        }

        return new Float32Attribute(textVertices, 2);
    }
    static _setupIndices(text){
        const textIndices = new Array(text.length * 6);

        //FOR EVERY CHARACTER OF THE TEXT STRING
        for(let c = 0; c < text.length; c++){
            textIndices[c*6 + 0] = 2*(c*2 + 0) + 0;
            textIndices[c*6 + 1] = 2*(c*2 + 0) + 1;
            textIndices[c*6 + 2] = 2*(c*2 + 1) + 0;

            textIndices[c*6 + 3] = 2*(c*2 + 1) + 0;
            textIndices[c*6 + 4] = 2*(c*2 + 0) + 1; 
            textIndices[c*6 + 5] = 2*(c*2 + 1) + 1;
        }

        return new Uint32Attribute(textIndices, 1);
    }
    static _setupUVs(text, font){
        const textUVs = new Array(text.length * 4 * 2);

        //FOR EVERY CHARACTER OF THE TEXT STRING
        for(let c = 0; c < text.length; c++){
            const character = text.charAt(c);

            if ( character == "\n" ) {
                continue;
            }
    
            if ( character == " " ) {
                continue;
            }

            var font_char = font.chars[character];

                
            if ( !font_char ) {                         // Substituting unavailable characters with '?'
                schar = "?";
                font_char = font.chars[ "?" ];
            }
            var g = font_char.rect;

            textUVs[c*4*2 + 0] = g[0];
            textUVs[c*4*2 + 1] = 1- g[1];

            textUVs[c*4*2 + 2] = g[0];
            textUVs[c*4*2 + 3] = 1- g[3];

            textUVs[c*4*2 + 4] = g[2];
            textUVs[c*4*2 + 5] = 1- g[1];

            textUVs[c*4*2 + 6] = g[2];
            textUVs[c*4*2 + 7] = 1- g[3];
            
        }

        return new Float32Attribute(textUVs, 2);
    }

    static _setupScale(text, font_metrics, font){
        const textScale = new Array(text.length * 4);

        for(let c = 0; c < text.length; c++){

            const character = text.charAt(c);

            if ( character == "\n" ) {
                continue;
            }
    
            if ( character == " " ) {
                continue;
            }

            var font_char = font.chars[character];

                
            if ( !font_char ) {                         // Substituting unavailable characters with '?'
                schar = "?";
                font_char = font.chars[ "?" ];
            }

            // Low case chars use their own scale
            var lowcase = ( font_char.flags & 1 ) == 1;
            
            var scale = lowcase ? font_metrics.low_scale : font_metrics.cap_scale;

            textScale[c*4 + 0] = scale;
            textScale[c*4 + 1] = scale;
            textScale[c*4 + 2] = scale;
            textScale[c*4 + 3] = scale;

        }
        return new Float32Attribute(textScale, 1);
    }

    static _setupScaleScreenMode(text, font_metrics, font){
        const textScale = new Array();

        for(let c = 0; c < text.length; c++){

            const character = text.charAt(c);

            if ( character == "\n" ) {
                continue;
            }
    
            if ( character == " " ) {
                continue;
            }

            var font_char = font.chars[character];

                
            if ( !font_char ) {                         // Substituting unavailable characters with '?'
                schar = "?";
                font_char = font.chars[ "?" ];
            }

            // Low case chars use their own scale
            var lowcase = ( font_char.flags & 1 ) == 1;
            
            var scale = lowcase ? font_metrics.low_scale : font_metrics.cap_scale;

            textScale.push(scale);
            textScale.push(scale);
            textScale.push(scale);
            textScale.push(scale);
            textScale.push(scale);
            textScale.push(scale);

        }
        return new Float32Attribute(textScale, 1);
    }

    static _assembleMaterial(args){
        var font_metrics = ZText._fontMetrics( args.font, args.fontSize*8, args.fontSize*8 * 0.2 );
        const material = new ZTextMaterial("ZText", {}, {"scale": this._setupScale(args.text, font_metrics, args.font)});
        material.setUniform("MODE", args.mode);
        material.setUniform("sdf_tex_width", args.sdf_tex_width);
        material.setUniform("sdf_tex_height", args.sdf_tex_height);
        material.setUniform("sdf_border_size", args.sdf_border_size);
        material.setUniform("hint_amount", args.fontHinting);
        material.setUniform("offset", [0,0]);
        material.setUniform("FinalOffset", [0,0]);




        return material;
    }

    setText2D(text, x, y, font_metrics, font){
        const vertices_positions = new Array();
        const vertices_uvs = new Array();

        var prev_char = " ";  // Used to calculate kerning
        var pos = [x,y];
        var cpos      = pos;  // Current pen position
        var x_max     = 0.0;  // Max width - used for bounding box
        var scale     = font_metrics.cap_scale;

        //FOR EVERY CHARACTER OF THE TEXT STRING
        for(let c = 0; c < text.length; c++){

            const character = text.charAt(c);

            if ( character == "\n" ) {
                if ( cpos[0] > x_max ) x_max = cpos[0]; // Expanding the bounding rect
                cpos[0]  = pos[0] ;                      
                cpos[1] -= font_metrics.line_height;
                prev_char = " ";
                continue;
            }
    
            if ( character == " " ) {
                cpos[0] += font.space_advance * scale; 
                prev_char = " ";
                continue;
            }

            // Laying out the glyph rectangle
            var font_char = font.chars[character];
            if ( !font_char ) {                         // Substituting unavailable characters with '?'
                font_char = font.chars[ "?" ];
            }

            var kern = font.kern[ prev_char + character ];
            if ( !kern ) kern = 0.0;

            var baseline = cpos[1] - font_metrics.ascent;
            var lowcase = ( font.chars[character].flags & 1 ) == 1;
            // Low case chars use their own scale
            var scale = lowcase ? font_metrics.low_scale : font_metrics.cap_scale;

            
            var g      = font_char.rect;

            var bottom = baseline - scale * ( font.descent + font.iy );
            var top    = bottom   + scale * ( font.row_height);
            var left   = cpos[0]   + font.aspect * scale * ( font_char.bearing_x + kern -  font.ix );
            var right  = left     + font.aspect * scale * ( g[2] - g[0] );




            //POSITIONs
            vertices_positions.push(left/this.screenW, top/this.screenH);
            vertices_positions.push(left/this.screenW, bottom/this.screenH);
            vertices_positions.push(right/this.screenW, top/this.screenH);
            vertices_positions.push(right/this.screenW, top/this.screenH);
            vertices_positions.push(left/this.screenW, bottom/this.screenH);
            vertices_positions.push(right/this.screenW, bottom/this.screenH);

            //UVs
            vertices_uvs.push(g[0], 1- g[1]);
            vertices_uvs.push(g[0], 1- g[3]);
            vertices_uvs.push(g[2],  1- g[1]);
            vertices_uvs.push(g[2],  1- g[1]);
            vertices_uvs.push(g[0], 1- g[3]);
            vertices_uvs.push(g[2], 1- g[3]);


            // Advancing pen position
            var new_pos_x = cpos[0] + font.aspect * scale * ( font_char.advance_x  );
            cpos = [ new_pos_x, cpos[1] ];
            prev_char = character;
            
        }

        const geometry = new Geometry();
        geometry.vertices = new Float32Attribute(vertices_positions, 2);
        geometry.uv = new Float32Attribute(vertices_uvs, 2);

        return geometry;
    }

    static _fontMetrics( font, pixel_size, more_line_gap = 0.0 ) {
        // We use separate scale for the low case characters
        // so that x-height fits the pixel grid.
        // Other characters use cap-height to fit to the pixels
        var cap_scale   = pixel_size / font.cap_height;
        var low_scale   = Math.round( font.x_height * cap_scale ) / font.x_height;

        // Ascent should be a whole number since it's used to calculate the baseline
        // position which should lie at the pixel boundary
        var ascent      = Math.round( font.ascent * cap_scale );
        
        // Same for the line height
        var line_height = Math.round( cap_scale * ( font.ascent + font.descent + font.line_gap ) + more_line_gap );
        
        return { cap_scale   : cap_scale,
                 low_scale   : low_scale,
                 pixel_size  : pixel_size,
                 ascent      : ascent,
                 line_height : line_height
               };
    } 

}

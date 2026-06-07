import * as RC from "../../src/RenderCore.js";


const canvas = new RC.Canvas(document.body);

const renderer = new RC.MeshRenderer(canvas, RC.WEBGL2);
renderer.addShaderLoaderUrls("../../src/shaders"); //change shaders 

const scene = new RC.Scene();
const camera = new RC.PerspectiveCamera(75, canvas.width/canvas.height, 0.125, 128);

camera.position = new RC.Vector3(0, 0, 100);

const dLight = new RC.DirectionalLight(
    new RC.Color("#FFFFFF"), 
    0.94, 
    {
        castShadows: false
    }
);
dLight.rotateX(0.1);
scene.add(dLight);

var subpixel = 1.0;

/*
// Loading SDF font images. Resulting textures should NOT be mipmapped!
roboto_font          "fonts/roboto.png"
roboto_bold_font     "fonts/roboto-bold.png"
ubuntu_font          "fonts/ubuntu.png"
ubuntu_bold_font     "fonts/ubuntu-bold.png"
dejavu_font          "fonts/dejavu-serif.png"
dejavu_italic_font   "fonts/dejavu-serif-italic.png"  
*/

const fontImgLoader = new RC.ImageLoader();

let textWorld;
let textScreen;
let speed = 0.3;

fontImgLoader.load("../common/textures/fonts/dejavu-serif-italic.png", function (image) {
    const fontTexture = new RC.Texture(
        image, 
        RC.Texture.WRAPPING.ClampToEdgeWrapping, 
        RC.Texture.WRAPPING.ClampToEdgeWrapping,
        RC.Texture.FILTER.NearestFilter, 
        RC.Texture.FILTER.NearestFilter,
        RC.Texture.FORMAT.RGBA, 
        RC.Texture.FORMAT.RGBA, 
        RC.Texture.TYPE.UNSIGNED_BYTE,
        image.width,
        image.height
    );
    fontTexture._generateMipmaps = false;

    textScreen = new RC.ZText(
        {
            text: 
            `To be, or not `, 
            fontTexture: fontTexture, 
            xPos: 10, 
            yPos: 150, 
            fontSize: 80, 
            cellAspect: 8/16, 
            mode: RC.ZTEXT_SPACE_SCREEN,
            fontHinting: 1.0,
            color: new RC.Color(0.0,0.0,1.0),
            sdf_tex_width: fontTexture.image.width,
            sdf_tex_height: fontTexture.image.height,
            font: RC.dejavu_italic_font,
        }
    );
    scene.add(textScreen);
});

fontImgLoader.load("../common/textures/fonts/dejavu-serif-italic.png", function (image) {
    const fontTexture = new RC.Texture(
        image, 
        RC.Texture.WRAPPING.ClampToEdgeWrapping, 
        RC.Texture.WRAPPING.ClampToEdgeWrapping,
        RC.Texture.FILTER.NearestFilter, 
        RC.Texture.FILTER.NearestFilter,
        RC.Texture.FORMAT.RGBA, 
        RC.Texture.FORMAT.RGBA, 
        RC.Texture.TYPE.UNSIGNED_BYTE,
        image.width,
        image.height
    );
    fontTexture._generateMipmaps = false;

    textWorld = new RC.ZText(
        {
            text: `To be, or not `, 
            fontTexture: fontTexture, 
            xPos: 0, 
            yPos: 0, 
            fontSize: 80, 
            cellAspect: 8/16, 
            mode: RC.ZTEXT_SPACE_WORLD,
            fontHinting: 1.0,
            color: new RC.Color(1.0,0.0,0.0),
            sdf_tex_width: fontTexture.image.width,
            sdf_tex_height: fontTexture.image.height,
            font: RC.dejavu_italic_font
        }
    );
    textWorld.position = new RC.Vector3(1, 4, 1);
    scene.add(textWorld);
});

function resizeFunction() {
    canvas.updateSize();
    renderer.updateViewport(canvas.width, canvas.height);
};

let initialMouseX;
let initialMouseY;
let firstMouseDown = true;

function mousedownFunction(event){
    if(firstMouseDown && event.which === 1)
    {
        initialMouseX = event.clientX;
        initialMouseY = event.clientY;
        firstMouseDown = false;

    }
    
}

function mousemoveFunction(event){
    if(!firstMouseDown)
    {
        const pixelRatio = window.devicePixelRatio || 1;
        const x = event.clientX ;//* pixelRatio;
        const y = event.clientY ;//* pixelRatio;

        textWorld.translateX((x - initialMouseX)*speed);
        textWorld.translateY((initialMouseY - y)*speed);
        initialMouseX = x;
        initialMouseY = y;

        textScreen.setOffset([x, canvas.height - y]);

    }    
}

function mouseupFunction(event){
    firstMouseDown = true;
}

function renderFunction() {
    renderer.render(scene, camera);   
    window.requestAnimationFrame(renderFunction);
    window.addEventListener("mousedown", mousedownFunction, false);
    window.addEventListener("mouseup", mouseupFunction, false);
    window.addEventListener("mousemove", mousemoveFunction, false);
}

window.onload = function() {
    window.addEventListener("resize", resizeFunction, false);
    resizeFunction();
    window.requestAnimationFrame(renderFunction);
};

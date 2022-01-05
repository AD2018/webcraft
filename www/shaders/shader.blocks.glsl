// we can't coment in block, because version must be a first command
#ifdef header
    #version 300 es
    precision highp float;
    precision mediump sampler3D;
    //--
#endif

#ifdef constants
    // basic constans block
    #define LOG2 1.442695
    #define PI 3.14159265359
    #define desaturateFactor 2.0
    #define aoFactor 1.0
#endif

#ifdef global_uniforms
    // global uniform block base
    uniform vec3 u_camera_pos;
    // Fog
    uniform vec4 u_fogColor;
    uniform vec4 u_fogAddColor;
    uniform bool u_fogOn;
    uniform float u_chunkBlockDist;

    //
    uniform float u_brightness;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform vec3 u_shift;
    uniform bool u_TestLightOn;
    uniform vec4 u_SunDir;
    uniform float u_localLightRadius;
    //--
#endif

#ifdef global_uniforms_frag
    // global uniforms fragment part
    uniform sampler2D u_texture;
    uniform lowp sampler3D u_lightTex;
    
    uniform float u_mipmap;
    uniform float u_blockSize;
    uniform float u_opaqueThreshold;
    //--

#endif 

#ifdef global_uniforms_vert
    // global uniforms vertex part
    uniform mat4 uProjMatrix;
    uniform mat4 u_worldView;
    uniform mat4 uModelMatrix;
    uniform vec3 u_add_pos;
    uniform float u_pixelSize;
    //--
#endif

#ifdef terrain_attrs_vert 
    // terrain shader attributes and varings
    in vec3 a_position;
    in vec3 a_axisX;
    in vec3 a_axisY;
    in vec2 a_uvCenter;
    in vec2 a_uvSize;
    in vec3 a_color;
    in float a_flags;
    in vec2 a_quad;

    // please, replace all out with v_
    out vec3 world_pos;
    out vec3 chunk_pos;
    out vec3 v_position;
    out vec2 v_texcoord;
    out vec4 v_texClamp;
    out vec3 v_normal;
    out vec4 v_color;
    out vec2 u_uvCenter;
    //--
#endif

#ifdef terrain_attrs_frag 
    // terrain shader attributes and varings
    in vec3 v_position;
    in vec2 v_texcoord;
    in vec4 v_texClamp;
    in vec4 v_color;
    in vec3 v_normal;
    in float v_fogDepth;
    in vec3 world_pos;
    in vec3 chunk_pos;
    in vec2 u_uvCenter;

    out vec4 outColor;
#endif


#ifdef crosshair_define_func
    // crosshair draw block
    void drawCrosshair() {
        float cm = 0.00065;
        vec4 crosshair; 

        if(u_resolution.x > u_resolution.y) {
            crosshair = vec4(0., 0., u_resolution.x * cm, u_resolution.x * cm * 7.);
        } else {
            crosshair = vec4(0., 0., u_resolution.y * cm, u_resolution.y * cm * 7.);
        }

        float w = u_resolution.x;
        float h = u_resolution.y;
        float x = gl_FragCoord.x;
        float y = gl_FragCoord.y;
        if((x > w / 2.0 - crosshair.w && x < w / 2.0 + crosshair.w &&
            y > h / 2.0 - crosshair.z && y < h / 2.0 + crosshair.z) ||
            (x > w / 2.0 - crosshair.z && x < w / 2.0 + crosshair.z &&
            y > h / 2.0 - crosshair.w && y < h / 2.0 + crosshair.w)
            ) {
                outColor.r = 1.0 - outColor.r;
                outColor.g = 1.0 - outColor.g;
                outColor.b = 1.0 - outColor.b;
                outColor.a = 1.0;
        }
    }
    //--
#endif

#ifdef crosshair_call_func
    // Draw crosshair
    drawCrosshair();
    //--
#endif

#ifdef vignetting_define_func
    // vignetting
    const float outerRadius = .65, innerRadius = .4, intensity = .1;
    const vec3 vignetteColor = vec3(0.0, 0.0, 0.0); // red

    // vignetting draw block
    void drawVignetting() {
        vec2 relativePosition = gl_FragCoord.xy / u_resolution - .5;
        relativePosition.y *= u_resolution.x / u_resolution.y;
        float len = length(relativePosition);
        float vignette = smoothstep(outerRadius, innerRadius, len);
        float vignetteOpacity = smoothstep(innerRadius, outerRadius, len) * intensity; // note inner and outer swapped to switch darkness to opacity
        outColor.rgb = mix(outColor.rgb, vignetteColor, vignetteOpacity);
    }
    //--
#endif

#ifdef vignetting_call_func
    // apply vignette to render result
    drawVignetting();
    //--
#endif

#ifdef manual_mip
    // apply manual mip
    if (u_mipmap > 0.0) {
        biome *= 0.5;

        // manual implementation of EXT_shader_texture_lod
        vec2 fw = fwidth(v_texcoord) * float(textureSize(u_texture, 0));
        fw /= 1.4;
        vec4 steps = vec4(step(2.0, fw.x), step(4.0, fw.x), step(8.0, fw.x), step(16.0, fw.x));
        mipOffset.x = dot(steps, vec4(0.5, 0.25, 0.125, 0.0625));
        mipScale.x = 0.5 / max(1.0, max(max(steps.x * 2.0, steps.y * 4.0), max(steps.z * 8.0, steps.w * 16.0)));
        steps = vec4(step(2.0, fw.y), step(4.0, fw.y), step(8.0, fw.y), step(16.0, fw.y));
        mipOffset.y = dot(steps, vec4(0.5, 0.25, 0.125, 0.0625));
        mipScale.y = 0.5 / max(1.0, max(max(steps.x * 2.0, steps.y * 4.0), max(steps.z * 8.0, steps.w * 16.0)));
    }
#endif

#ifdef fog_frag
    // Calc fog amount
    float fogDistance = length(world_pos.xy);
    float fogAmount = 0.;
    if(fogDistance > u_chunkBlockDist) {
        fogAmount = clamp(0.05 * (fogDistance - u_chunkBlockDist), 0., 1.);
    }

    // Apply fog
    outColor = mix(outColor, u_fogColor, fogAmount);
    outColor.r = (outColor.r * (1. - u_fogAddColor.a) + u_fogAddColor.r * u_fogAddColor.a);
    outColor.g = (outColor.g * (1. - u_fogAddColor.a) + u_fogAddColor.g * u_fogAddColor.a);
    outColor.b = (outColor.b * (1. - u_fogAddColor.a) + u_fogAddColor.b * u_fogAddColor.a);

#endif
#version 330


// SIMULATION PARAMETERS
uniform float ASPECT;
uniform float FOV;
uniform int MIN_ITERATIONS;
uniform int MAX_ITERATIONS;
uniform float RAYMARCH_EPSILON;
uniform float NORMAL_EPSILON;
uniform float DE_POWER;
uniform float DE_POWER_SCALE; 
uniform vec3 COLOR_SHADOW;
uniform vec3 COLOR_MID;
uniform vec3 COLOR_HIGHLIGHT;

// FRAME UPDATE UNIFORMS
uniform vec3 camera_pos;
uniform float radius; 
uniform float time;

float eps = RAYMARCH_EPSILON;
in vec2 uv;
out vec4 frag_color;

vec3 rayDirection(vec2 uv)
{
    vec2 p = uv * 2.0 - 1.0;

    return normalize(vec3(
        p.x,
        p.y,
        -1.0
    ));
}

int getIterations()
{
    float lod = log(radius + 1.0);

    int iters = int(mix(6.0, 20.0, clamp(1.0 / lod, 0.0, 1.0)));

    return iters;
}

int getIterations2()
{
    float zoom = clamp(1.0 - radius / 10.0, 0.0, 1.0);

    return int(
        mix(
            float(MIN_ITERATIONS),
            float(MAX_ITERATIONS),
            zoom
        )
    );
}

float getPower()
{
    return mix(DE_POWER-DE_POWER_SCALE, 
               DE_POWER+DE_POWER_SCALE, 
               0.5 + 0.5 * sin(time * 0.2));
}

float sphereDE(vec3 p)
{
    return length(p) - 1.0;
}

float mandelbulbDE(vec3 pos, float power)
{
    vec3 z = pos;

    float dr = 1.0;
    float r = 0.0;

    int ITERS = getIterations2();

    for(int i = 0; i < MAX_ITERATIONS; i++)
    {
        if(i >= ITERS) break;

        r = length(z);

        if(r > 2.0) break;

        float theta = acos(z.z / r);
        float phi = atan(z.y, z.x);

        float rp = pow(r, power);

        dr = power * pow(r, power - 1.0) * dr + 1.0;

        theta *= power;
        phi *= power;

        z = rp * vec3(
            sin(theta) * cos(phi),
            sin(theta) * sin(phi),
            cos(theta)
        ) + pos;
    }

    return 0.5 * log(r) * r / dr;
}

float rayMarch(vec3 ro, vec3 rd, float power, out int steps)
{
    float t = 0.0;

    int MAX_STEPS = int(mix(40.0, 120.0, clamp(1.0 / log(radius + 1.0), 0.0, 1.0)));

    for(int i = 0; i < MAX_STEPS; i++)
    {
        vec3 p = ro + rd * t;

        float d = mandelbulbDE(p, power);

        if(d < eps)
        {
            steps = i;
            return t;
        }

        t += d;

        if(t > radius * 50)
            break;
    }

    steps = 100;
    return -1.0;
}

vec3 getNormalSphere(vec3 p)
{
    float e = 0.001;

    return normalize(vec3(
        sphereDE(p + vec3(e,0,0)) - sphereDE(p - vec3(e,0,0)),
        sphereDE(p + vec3(0,e,0)) - sphereDE(p - vec3(0,e,0)),
        sphereDE(p + vec3(0,0,e)) - sphereDE(p - vec3(0,0,e))
    ));
}

vec3 getNormalBulb(vec3 p, float power)
{
  //float e = max(eps * 5, 1e-5);
    float e = NORMAL_EPSILON * radius;

    return normalize(vec3(
        mandelbulbDE(p + vec3(e,0,0), power) -
        mandelbulbDE(p - vec3(e,0,0), power),

        mandelbulbDE(p + vec3(0,e,0), power) -
        mandelbulbDE(p - vec3(0,e,0), power),

        mandelbulbDE(p + vec3(0,0,e), power) -
        mandelbulbDE(p - vec3(0,0,e), power)
    ));
}

void main()
{
    vec3 ro = camera_pos;
    float power = getPower();
    vec3 forward = normalize(-camera_pos);
    vec3 worldUp = vec3(0.0, 1.0, 0.0);
    vec3 right = normalize(cross(worldUp, forward));
    vec3 up = cross(forward, right);

    vec2 p = uv * 2.0 - 1.0;
    p.x *= ASPECT;

    float scale = tan(radians(FOV) * 0.5);

    vec3 rd = normalize(
        forward +
        right * p.x * scale +
        up * p.y * scale
    );

    int steps;
    float t = rayMarch(ro, rd, power, steps);

    if(t < 0.0)
    {
        frag_color = vec4(0.0);
        return;
    }

    vec3 hit = ro + rd * t;
    vec3 normal = getNormalBulb(hit, power);

    vec3 lightPos = vec3(5.0);
    vec3 lightDir = normalize(lightPos - hit);

    float diffuse = max(dot(normal, lightDir), 0.0);
    float ambient = 0.5;
    //float lighting = ambient + diffuse * (1.0 - ambient);
    float lighting = smoothstep(0.0, 1.0, diffuse);

    vec3 col = mix(COLOR_SHADOW, COLOR_MID, lighting);

    col = mix(
        col,
        COLOR_HIGHLIGHT,
        pow(diffuse, 4.0)
    );

    frag_color = vec4(col, 1.0);
}
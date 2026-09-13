// Allow an isolated local verification build while another task runs Next.js.
export default {
  distDir: process.env.ASTRA_SCENE_BUILD === "1" ? ".next-planet-scene" : ".next",
};

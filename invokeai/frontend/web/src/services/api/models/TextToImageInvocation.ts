/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

/**
 * Generates an image using text2img.
 */
export type TextToImageInvocation = {
  /**
   * The id of this node. Must be unique among all nodes.
   */
  id: string;
  type?: 'txt2img';
  /**
   * The prompt to generate an image from
   */
  prompt?: string;
  /**
   * The seed to use (omit for random)
   */
  seed?: number;
  /**
   * The number of steps to use to generate the image
   */
  steps?: number;
  /**
   * The width of the resulting image
   */
  width?: number;
  /**
   * The height of the resulting image
   */
  height?: number;
  /**
   * The Classifier-Free Guidance, higher values may result in a result closer to the prompt
   */
  cfg_scale?: number;
  /**
   * The scheduler to use
   */
  scheduler?: 'ddim' | 'ddpm' | 'deis' | 'lms' | 'pndm' | 'heun' | 'heun_k' | 'euler' | 'euler_k' | 'euler_a' | 'kdpm_2' | 'kdpm_2_a' | 'dpmpp_2s' | 'dpmpp_2m' | 'dpmpp_2m_k' | 'unipc';
  /**
   * The model to use (currently ignored)
   */
  model?: string;
};


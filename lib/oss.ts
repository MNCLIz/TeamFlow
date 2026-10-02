import OSS from "ali-oss";

export const ossClient = new OSS({
  region: process.env.OSS_REGION!,
  bucket: process.env.OSS_BUCKET!,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET!,
  authorizationV4: true,
});
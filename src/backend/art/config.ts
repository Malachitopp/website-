import { v2 as cloudinary } from 'cloudinary'


function required(name: string): string {
  const value = process.env[name];
  if (!value) { throw new Error(`missing env var: ${name}`); }
  return value;
}



cloudinary.config({
  cloud_name: required('CLOUDINARY_CLOUD_NAME'),
  api_key: required('CLOUDINARY_API_KEY'),
  api_secret: required('CLOUDINARY_API_SECRET'),
  secure: true
});

export { cloudinary };


const IMGBB_API_KEY = 'bc34c62f7ebe02242255b85abe51e771';

export const uploadToImgBB = async (file: File): Promise<string | null> => {
  const formData = new FormData();
  formData.append('image', file);
  // ImgBB allows expiration, but for persistent avatars/diaries, we usually don't set it.
  // If you want auto-delete after 600 seconds, append: formData.append('expiration', '600');

  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (data.success) {
      return data.data.url; // Returns the direct link to the image
    } else {
      console.error("ImgBB Upload Error:", data);
      alert(`Upload failed: ${data.error?.message || 'Unknown error'}`);
      return null;
    }
  } catch (error) {
    console.error("Network Error:", error);
    alert("Network error while uploading image.");
    return null;
  }
};

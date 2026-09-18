import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export async function uploadHotelLogo(file: File): Promise<string> {
  const extension = file.name.split('.').pop() || 'png';
  const logoRef = ref(storage, `hotel_assets/logo_${Date.now()}.${extension}`);
  const snapshot = await uploadBytes(logoRef, file);
  const downloadUrl = await getDownloadURL(snapshot.ref);
  return downloadUrl;
}

export async function uploadGuestIdDoc(guestId: string, file: File): Promise<string> {
  const extension = file.name.split('.').pop() || 'jpg';
  const idDocRef = ref(storage, `guest_ids/${guestId}_${Date.now()}.${extension}`);
  const snapshot = await uploadBytes(idDocRef, file);
  const downloadUrl = await getDownloadURL(snapshot.ref);
  return downloadUrl;
}

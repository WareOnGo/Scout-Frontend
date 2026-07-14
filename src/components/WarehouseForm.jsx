import { useState, useEffect, useCallback, useRef } from 'react';
import FileUpload from './FileUpload';
import './WarehouseForm.css';
import { clearErrors } from '../utils/errorHandler';
import { useViewport } from '../hooks/useViewport';
import { getMediaFromWarehouse } from '../utils/mediaUtils';
import { looksLikePhone } from '../utils/phone';

// ── Tiny helpers ──────────────────────────────────────────────────────────────

const LAND_TYPES = ['Warehouse CLU', 'Commercial CLU', 'Industrial CLU', 'Others'];
const POLLUTION_ZONES = ['Green', 'Yellow', 'Red'];
const OWNER_TYPES = ['Individual', 'Company', '3PL'];
const OWNER_WARMTH_OPTIONS = ['Green', 'Yellow', 'Red'];
const WAREHOUSE_TYPES = ['PEB', 'RCC', 'Shed', 'BTS'];

const INDIA_STATE_CITIES = {
  'Andhra Pradesh': ['Alluri Sitharama Raju', 'Anakapalli', 'Anantapur', 'Ananthapuramu', 'Annamayya', 'Bapatla', 'Bhimavaram', 'Chittoor', 'Dr. B. R. Ambedkar Konaseema', 'East Godavari', 'Eluru', 'Guntur', 'Hindupur', 'Kadapa', 'Kakinada', 'Krishna', 'Kurnool', 'Machilipatnam', 'Markapuram', 'Nandyal', 'Nellore', 'NTR', 'Ongole', 'Palnadu', 'Parvathipuram Manyam', 'Polavaram', 'Prakasam', 'Rajahmundry', 'Sri Potti Sriramulu Nellore', 'Sri Sathya Sai', 'Srikakulam', 'Tenali', 'Tirupati', 'Vijayawada', 'Visakhapatnam', 'Vizianagaram', 'West Godavari', 'YSR Kadapa'],
  'Arunachal Pradesh': ['Along', 'Anjaw', 'Bichom', 'Bomdila', 'Changlang', 'Dibang Valley', 'East Kameng', 'East Siang', 'Itanagar', 'Kamle', 'Keyi Panyor', 'Kra Daadi', 'Kurung Kumey', 'Lepa-Rada', 'Lohit', 'Longding', 'Lower Dibang Valley', 'Lower Siang', 'Lower Subansiri', 'Naharlagun', 'Namsai', 'Pakke-Kessang', 'Papum Pare', 'Pasighat', 'Shi-Yomi', 'Siang', 'Tawang', 'Tirap', 'Upper Siang', 'Upper Subansiri', 'West Kameng', 'West Siang', 'Ziro'],
  'Assam': ['Bajali', 'Baksa', 'Barpeta', 'Biswanath', 'Bongaigaon', 'Cachar', 'Charaideo', 'Chirang', 'Darrang', 'Dhemaji', 'Dhubri', 'Dibrugarh', 'Dima Hasao', 'Goalpara', 'Golaghat', 'Guwahati', 'Hailakandi', 'Hojai', 'Jorhat', 'Kamrup', 'Kamrup Metropolitan', 'Karbi Anglong', 'Karimganj', 'Kokrajhar', 'Lakhimpur', 'Majuli', 'Morigaon', 'Nagaon', 'Nalbari', 'Silchar', 'Sivasagar', 'Sonitpur', 'South Salmara-Mankachar', 'Sribhumi', 'Tamulpur', 'Tezpur', 'Tinsukia', 'Udalguri', 'West Karbi Anglong'],
  'Bihar': ['Ara', 'Araria', 'Arwal', 'Aurangabad', 'Banka', 'Begusarai', 'Bettiah', 'Bhagalpur', 'Bhojpur', 'Bihar Sharif', 'Buxar', 'Chapra', 'Darbhanga', 'East Champaran', 'Gaya', 'Gopalganj', 'Hajipur', 'Jamui', 'Jehanabad', 'Kaimur', 'Katihar', 'Khagaria', 'Kishanganj', 'Lakhisarai', 'Madhepura', 'Madhubani', 'Motihari', 'Munger', 'Muzaffarpur', 'Nalanda', 'Nawada', 'Patna', 'Purnia', 'Rohtas', 'Saharsa', 'Samastipur', 'Saran', 'Sasaram', 'Sheikhpura', 'Sheohar', 'Sitamarhi', 'Siwan', 'Supaul', 'Vaishali', 'West Champaran'],
  'Chhattisgarh': ['Ambikapur', 'Balod', 'Baloda Bazar', 'Balrampur', 'Bastar', 'Bemetara', 'Bhilai', 'Bijapur', 'Bilaspur', 'Dantewada', 'Dhamtari', 'Durg', 'Gariaband', 'Gaurela-Pendra-Marwahi', 'Jagdalpur', 'Janjgir-Champa', 'Jashpur', 'Kabirdham', 'Kanker', 'Kawardha', 'Khairagarh-Chhuikhadan-Gandai', 'Kondagaon', 'Korba', 'Koriya', 'Mahasamund', 'Manendragarh-Chirmiri-Bharatpur', 'Mohla-Manpur-Ambagarh Chowki', 'Mungeli', 'Narayanpur', 'Raigarh', 'Raipur', 'Rajnandgaon', 'Sakti', 'Sarangarh-Bilaigarh', 'Sukma', 'Surajpur', 'Surguja'],
  'Goa': ['Bicholim', 'Calangute', 'Kushavati', 'Mapusa', 'Margao', 'Mormugao', 'North Goa', 'Panaji', 'Ponda', 'Sanquelim', 'South Goa', 'Vasco da Gama'],
  'Gujarat': ['Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha', 'Bharuch', 'Bhavnagar', 'Botad', 'Chhota Udaipur', 'Dahej', 'Dahod', 'Dang', 'Devbhoomi Dwarka', 'Dwarka', 'Gandhidham', 'Gandhinagar', 'Gir Somnath', 'Halol', 'Jamnagar', 'Junagadh', 'Kheda', 'Kutch', 'Mahisagar', 'Mehsana', 'Morbi', 'Mundra', 'Nadiad', 'Narmada', 'Navsari', 'Panchmahal', 'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Sanand', 'Surat', 'Surendranagar', 'Tapi', 'Vadodara', 'Valsad'],
  'Haryana': ['Ambala', 'Bahadurgarh', 'Bawal', 'Bhiwani', 'Charkhi Dadri', 'Faridabad', 'Fatehabad', 'Gurugram', 'Hisar', 'Jhajjar', 'Jind', 'Kaithal', 'Karnal', 'Kundli', 'Kurukshetra', 'Mahendragarh', 'Manesar', 'Narnaul', 'Nuh', 'Palwal', 'Panchkula', 'Panipat', 'Rewari', 'Rohtak', 'Sirsa', 'Sonipat', 'Yamunanagar'],
  'Himachal Pradesh': ['Baddi', 'Bilaspur', 'Chamba', 'Dharamshala', 'Hamirpur', 'Kangra', 'Kinnaur', 'Kullu', 'Lahaul and Spiti', 'Mandi', 'Nahan', 'Nalagarh', 'Paonta Sahib', 'Shimla', 'Sirmaur', 'Solan', 'Una'],
  'Jharkhand': ['Bokaro', 'Chaibasa', 'Chatra', 'Chirkunda', 'Deoghar', 'Dhanbad', 'Dumka', 'East Singhbhum', 'Garhwa', 'Giridih', 'Godda', 'Gumla', 'Hazaribagh', 'Jamshedpur', 'Jamtara', 'Khunti', 'Koderma', 'Latehar', 'Lohardaga', 'Medininagar', 'Pakur', 'Palamu', 'Phusro', 'Ramgarh', 'Ranchi', 'Sahebganj', 'Seraikela Kharsawan', 'Simdega', 'West Singhbhum'],
  'Karnataka': ['Bagalkot', 'Ballari', 'Bangalore', 'Belagavi', 'Bengaluru Rural', 'Bengaluru Urban', 'Bidar', 'Chamarajanagar', 'Chikballapur', 'Chikkamagaluru', 'Chitradurga', 'Dakshina Kannada', 'Davanagere', 'Dharwad', 'Gadag', 'Hassan', 'Haveri', 'Hosapete', 'Hubballi', 'Kalaburagi', 'Kodagu', 'Kolar', 'Koppal', 'Mandya', 'Mangaluru', 'Mysuru', 'Raichur', 'Ramanagara', 'Robertsonpet', 'Shivamogga', 'Tumakuru', 'Udupi', 'Uttara Kannada', 'Vijayanagara', 'Vijayapura', 'Yadgir'],
  'Kerala': ['Alappuzha', 'Attingal', 'Ernakulam', 'Idukki', 'Irinjalakuda', 'Kannur', 'Kasaragod', 'Kochi', 'Kollam', 'Kottayam', 'Kozhikode', 'Malappuram', 'Palakkad', 'Pathanamthitta', 'Punalur', 'Thiruvananthapuram', 'Thrippunithura', 'Thrissur', 'Wayanad'],
  'Madhya Pradesh': ['Agar Malwa', 'Alirajpur', 'Anuppur', 'Ashoknagar', 'Balaghat', 'Barwani', 'Betul', 'Bhind', 'Bhopal', 'Burhanpur', 'Chhatarpur', 'Chhindwara', 'Damoh', 'Datia', 'Dewas', 'Dhar', 'Dindori', 'Guna', 'Gwalior', 'Harda', 'Hoshangabad', 'Indore', 'Itarsi', 'Jabalpur', 'Jhabua', 'Katni', 'Khandwa', 'Khargone', 'Maihar', 'Mandla', 'Mandsaur', 'Mauganj', 'Morena', 'Murwara', 'Narmadapuram', 'Narsinghpur', 'Neemuch', 'Niwari', 'Pandhurna', 'Panna', 'Pithampur', 'Raisen', 'Rajgarh', 'Ratlam', 'Rewa', 'Sagar', 'Satna', 'Sehore', 'Seoni', 'Shahdol', 'Shajapur', 'Sheopur', 'Shivpuri', 'Sidhi', 'Singrauli', 'Tikamgarh', 'Ujjain', 'Umaria', 'Vidisha'],
  'Maharashtra': ['Ahilyanagar / Ahmednagar', 'Ahmednagar', 'Akola', 'Amravati', 'Beed', 'Bhandara', 'Bhiwandi', 'Buldhana', 'Chandrapur', 'Chhatrapati Sambhajinagar', 'Chhatrapati Sambhajinagar / Aurangabad', 'Dharashiv', 'Dharashiv / Osmanabad', 'Dhule', 'Dombivli', 'Gadchiroli', 'Gondia', 'Hingoli', 'Jalgaon', 'Jalna', 'Kalyan', 'Kolhapur', 'Latur', 'Malegaon', 'Mumbai', 'Mumbai City', 'Mumbai Suburban', 'Nagpur', 'Nanded', 'Nandurbar', 'Nashik', 'Navi Mumbai', 'Palghar', 'Panvel', 'Parbhani', 'Pimpri-Chinchwad', 'Pune', 'Raigad', 'Ratnagiri', 'Sangli', 'Satara', 'Sindhudurg', 'Solapur', 'Thane', 'Vasai-Virar', 'Wardha', 'Washim', 'Yavatmal'],
  'Manipur': ['Bishnupur', 'Chandel', 'Churachandpur', 'Imphal', 'Imphal East', 'Imphal West', 'Jiribam', 'Kakching', 'Kamjong', 'Kangpokpi', 'Noney', 'Pherzawl', 'Senapati', 'Tamenglong', 'Tengnoupal', 'Thoubal', 'Ukhrul'],
  'Meghalaya': ['Baghmara', 'East Garo Hills', 'East Jaintia Hills', 'East Khasi Hills', 'Eastern West Khasi Hills', 'Jowai', 'Nongstoin', 'North Garo Hills', 'Ri Bhoi', 'Shillong', 'South Garo Hills', 'South West Garo Hills', 'South West Khasi Hills', 'Tura', 'West Garo Hills', 'West Jaintia Hills', 'West Khasi Hills', 'Williamnagar'],
  'Mizoram': ['Aizawl', 'Champhai', 'Hnahthial', 'Khawzawl', 'Kolasib', 'Lawngtlai', 'Lunglei', 'Mamit', 'Saiha', 'Saitual', 'Serchhip'],
  'Nagaland': ['Chümoukedima', 'Dimapur', 'Kiphire', 'Kohima', 'Longleng', 'Meluri', 'Mokokchung', 'Mon', 'Niuland', 'Noklak', 'Peren', 'Phek', 'Shamator', 'Tseminyü', 'Tuensang', 'Wokha', 'Zunheboto', 'Zünheboto'],
  'Odisha': ['Angul', 'Balangir', 'Balasore', 'Barbil', 'Bargarh', 'Baripada', 'Bhadrak', 'Bhawanipatna', 'Bhubaneswar', 'Boudh', 'Brahmapur', 'Cuttack', 'Debagarh', 'Dhenkanal', 'Gajapati', 'Ganjam', 'Jagatsinghpur', 'Jajpur', 'Jharsuguda', 'Kalahandi', 'Kandhamal', 'Kendrapara', 'Kendujhar', 'Khordha', 'Koraput', 'Malkangiri', 'Mayurbhanj', 'Nabarangpur', 'Nayagarh', 'Nuapada', 'Paradip', 'Puri', 'Rayagada', 'Rourkela', 'Sambalpur', 'Subarnapur', 'Sundargarh', 'Talcher'],
  'Punjab': ['Abohar', 'Amritsar', 'Barnala', 'Bathinda', 'Faridkot', 'Fatehgarh Sahib', 'Fazilka', 'Firozpur', 'Gurdaspur', 'Hoshiarpur', 'Jalandhar', 'Kapurthala', 'Ludhiana', 'Malerkotla', 'Mansa', 'Moga', 'Mohali', 'Muktsar', 'Pathankot', 'Patiala', 'Phagwara', 'Rajpura', 'Ropar', 'Rupnagar', 'Sahibzada Ajit Singh Nagar', 'Sangrur', 'Shaheed Bhagat Singh Nagar', 'Sri Muktsar Sahib', 'Tarn Taran'],
  'Rajasthan': ['Ajmer', 'Alwar', 'Balotra', 'Banswara', 'Baran', 'Barmer', 'Beawar', 'Bharatpur', 'Bhilwara', 'Bhiwadi', 'Bikaner', 'Bundi', 'Chittorgarh', 'Churu', 'Dausa', 'Deeg', 'Dholpur', 'Didwana-Kuchaman', 'Dungarpur', 'Hanumangarh', 'Jaipur', 'Jaisalmer', 'Jalore', 'Jhalawar', 'Jhunjhunu', 'Jodhpur', 'Karauli', 'Khairthal-Tijara', 'Kishangarh', 'Kota', 'Kotputli-Behror', 'Nagaur', 'Neemrana', 'Pali', 'Phalodi', 'Pratapgarh', 'Rajsamand', 'Salumbar', 'Sawai Madhopur', 'Sikar', 'Sirohi', 'Sri Ganganagar', 'Tonk', 'Udaipur'],
  'Sikkim': ['Gangtok', 'Gyalshing', 'Jorethang', 'Mangan', 'Namchi', 'Pakyong', 'Rangpo', 'Soreng'],
  'Tamil Nadu': ['Ambattur', 'Ariyalur', 'Avadi', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri', 'Dindigul', 'Erode', 'Hosur', 'Kallakurichi', 'Kanchipuram', 'Kanyakumari', 'Karur', 'Krishnagiri', 'Kumbakonam', 'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Nagercoil', 'Namakkal', 'Ooty', 'Perambalur', 'Pudukkottai', 'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga', 'Sivakasi', 'Sriperumbudur', 'Tambaram', 'Tenkasi', 'Thanjavur', 'The Nilgiris', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli', 'Tirupattur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Vellore', 'Viluppuram', 'Virudhunagar'],
  'Telangana': ['Adilabad', 'Bhadradri Kothagudem', 'Bhongir', 'Hanumakonda', 'Hyderabad', 'Jagtial', 'Jangaon', 'Jayashankar Bhupalpally', 'Jogulamba Gadwal', 'Kamareddy', 'Karimnagar', 'Khammam', 'Kumuram Bheem', 'Mahabubabad', 'Mahabubnagar', 'Mahbubnagar', 'Mancherial', 'Medak', 'Medchal', 'Medchal-Malkajgiri', 'Miryalaguda', 'Mulugu', 'Nagarkurnool', 'Nalgonda', 'Narayanpet', 'Nirmal', 'Nizamabad', 'Peddapalli', 'Rajanna Sircilla', 'Ramagundam', 'Ranga Reddy', 'Sangareddy', 'Shamirpet', 'Siddipet', 'Suryapet', 'Vikarabad', 'Wanaparthy', 'Warangal', 'Yadadri Bhuvanagiri', 'Zaheerabad'],
  'Tripura': ['Agartala', 'Ambassa', 'Belonia', 'Dhalai', 'Dharmanagar', 'Gomati', 'Kailasahar', 'Khowai', 'North Tripura', 'Sabroom', 'Sepahijala', 'South Tripura', 'Udaipur', 'Unakoti', 'West Tripura'],
  'Uttar Pradesh': ['Agra', 'Aligarh', 'Ambedkar Nagar', 'Amethi', 'Amroha', 'Auraiya', 'Ayodhya', 'Azamgarh', 'Baghpat', 'Bahraich', 'Ballia', 'Balrampur', 'Banda', 'Barabanki', 'Bareilly', 'Basti', 'Bhadohi', 'Bijnor', 'Budaun', 'Bulandshahr', 'Chandauli', 'Chitrakoot', 'Deoria', 'Etah', 'Etawah', 'Faizabad', 'Farrukhabad', 'Fatehpur', 'Firozabad', 'Gautam Buddha Nagar', 'Ghaziabad', 'Ghazipur', 'Gonda', 'Gorakhpur', 'Greater Noida', 'Hamirpur', 'Hapur', 'Hardoi', 'Hathras', 'Jalaun', 'Jaunpur', 'Jhansi', 'Kannauj', 'Kanpur', 'Kanpur Dehat', 'Kanpur Nagar', 'Kasganj', 'Kaushambi', 'Kushinagar', 'Lakhimpur', 'Lakhimpur Kheri', 'Lalitpur', 'Lucknow', 'Maharajganj', 'Mahoba', 'Mainpuri', 'Mathura', 'Mau', 'Meerut', 'Mirzapur', 'Moradabad', 'Muzaffarnagar', 'Noida', 'Pilibhit', 'Pratapgarh', 'Prayagraj', 'Rae Bareli', 'Raebareli', 'Rampur', 'Saharanpur', 'Sambhal', 'Sant Kabir Nagar', 'Shahjahanpur', 'Shamli', 'Shravasti', 'Siddharthnagar', 'Sitapur', 'Sonbhadra', 'Sultanpur', 'Unnao', 'Varanasi', 'Vrindavan'],
  'Uttarakhand': ['Almora', 'Bageshwar', 'Chamoli', 'Champawat', 'Dehradun', 'Haldwani', 'Haridwar', 'Kashipur', 'Kotdwar', 'Nainital', 'Pauri Garhwal', 'Pithoragarh', 'Ramnagar', 'Rishikesh', 'Roorkee', 'Rudraprayag', 'Rudrapur', 'Sitarganj', 'Tehri Garhwal', 'Udham Singh Nagar', 'Uttarkashi'],
  'West Bengal': ['Alipurduar', 'Asansol', 'Bally', 'Bankura', 'Barasat', 'Bardhaman', 'Barrackpore', 'Birbhum', 'Cooch Behar', 'Dakshin Dinajpur', 'Darjeeling', 'Durgapur', 'Haldia', 'Hooghly', 'Howrah', 'Jalpaiguri', 'Jhargram', 'Kalimpong', 'Kalyani', 'Kharagpur', 'Kolkata', 'Krishnanagar', 'Malda', 'Murshidabad', 'Nadia', 'North 24 Parganas', 'Paschim Bardhaman', 'Paschim Medinipur', 'Purba Bardhaman', 'Purba Medinipur', 'Purulia', 'Raiganj', 'Rishra', 'Serampore', 'Shantipur', 'Siliguri', 'South 24 Parganas', 'Uluberia', 'Uttar Dinajpur'],
  // Union Territories
  'Andaman and Nicobar Islands': ['Car Nicobar', 'Diglipur', 'Mayabunder', 'Nicobar', 'North and Middle Andaman', 'Port Blair', 'Rangat', 'South Andaman'],
  'Chandigarh': ['Chandigarh'],
  'Dadra and Nagar Haveli and Daman and Diu': ['Amli', 'Dadra and Nagar Haveli', 'Daman', 'Diu', 'Silvassa'],
  'Delhi': ['Central Delhi', 'Central North Delhi', 'Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'North East Delhi', 'North West Delhi', 'Old Delhi', 'Outer North Delhi', 'South Delhi', 'South East Delhi', 'South West Delhi', 'West Delhi'],
  'Jammu and Kashmir': ['Anantnag', 'Bandipora', 'Baramulla', 'Budgam', 'Doda', 'Ganderbal', 'Jammu', 'Kathua', 'Kishtwar', 'Kulgam', 'Kupwara', 'Poonch', 'Pulwama', 'Rajouri', 'Ramban', 'Reasi', 'Samba', 'Shopian', 'Sopore', 'Srinagar', 'Udhampur'],
  'Ladakh': ['Changthang', 'Drass', 'Kargil', 'Leh', 'Nubra', 'Sham', 'Zanskar'],
  'Lakshadweep': ['Agatti', 'Andrott', 'Kavaratti', 'Lakshadweep', 'Minicoy'],
  'Puducherry': ['Karaikal', 'Mahe', 'Puducherry', 'Yanam'],
};
const INDIA_STATES = Object.keys(INDIA_STATE_CITIES).sort();

const formSteps = [
  { title: 'Owner Details', fields: ['listing_type', 'contactPerson', 'contactNumber', 'alt_phone_number', 'uploadedBy'] },
  { title: 'Location Details', fields: ['address', 'city', 'state'] },
  { title: 'Technical Specs', fields: ['warehouseType', 'totalSpaceSqft', 'chargeableArea'] },
  { title: 'Compliances', fields: ['compliances'] },
  { title: 'Commercials', fields: ['ratePerSqft'] },
  { title: 'Media', fields: [] },
  { title: 'Scout Notes', fields: [] },
];

const INITIAL_VALUES = {
  warehouseOwnerType: '', warehouseType: '', address: '',
  city: '', state: '', postalCode: '', googleLocation: '',
  contactPerson: '', contactNumber: '',
  totalSpaceSqft: [1000], ratePerSqft: '', offeredSpaceSqft: '', numberOfDocks: '',
  clearHeightFt: '', availability: '', isBroker: '', uploadedBy: '',
  compliances: '', otherSpecifications: '',
  fireNocAvailable: false,
  fireSafetyMeasures: '', landType: '', approachRoadWidth: '',
  powerKva: '', pollutionZone: '', vaastuCompliance: '',
  parkingDockingSpace: '', photos: '', media: null,
  // Newly added fields
  listing_type: '',
  alt_phone_number: '', land_parcel_size: '', builtup_area: '',
  owner_warmnth: '', distance_from_highway: '', is_builder: false,
  owner_of_multiple_sites: '', carpet_area: '', nearest_transport: '',
  fire_exits: '', fire_compliance_cert_type: '',
  washroom_count: '',
  ownerCompanyName: '', ownerAltPoc: '',
  gateSizeFt: '', dockApronLengthFt: '', setbackArea: '', ccRoads: '',
  wallAndSecurityRoom: '', plinthHeightFt: '',
  dockDimension: '', canopyType: '', dockPlatformType: '', otherDockingSpecs: '',
  flooringType: '', floorStrengthPerSqm: '', ventilationType: '',
  insulationPresent: '', insulationType: '',
  lightingDetails: '', centreHeight: '',
  cam: '', chargeableArea: '',
  scoutNotes: '',
};

/** Flatten initialData (including nested WarehouseData) into form shape */
const toFormValues = (d) => {
  if (!d) return { ...INITIAL_VALUES };
  const wd = d.WarehouseData || d.warehouseData || {};
  return {
    warehouseOwnerType: d.warehouseOwnerType || '',
    warehouseType: d.warehouseType || '',
    address: d.address || '',
    city: d.city || '',
    state: d.state || '',
    postalCode: d.postalCode || '',
    googleLocation: d.googleLocation || '',
    contactPerson: d.contactPerson || '',
    contactNumber: d.contactNumber || '',
    totalSpaceSqft: Array.isArray(d.totalSpaceSqft)
      ? d.totalSpaceSqft
      : d.totalSpaceSqft ? [d.totalSpaceSqft] : [1000],
    ratePerSqft: d.ratePerSqft ?? '',
    offeredSpaceSqft: d.offeredSpaceSqft ?? '',
    numberOfDocks: d.numberOfDocks ?? '',
    clearHeightFt: d.clearHeightFt ?? '',
    availability: d.availability || '',
    isBroker: d.isBroker || '',
    uploadedBy: d.uploadedBy || '',
    compliances: d.compliances || '',
    otherSpecifications: d.otherSpecifications || '',
    fireNocAvailable: wd.fireNocAvailable === true || wd.fireNocAvailable === 'true',
    fireSafetyMeasures: wd.fireSafetyMeasures || '',
    landType: wd.landType || '',
    approachRoadWidth: wd.approachRoadWidth ?? '',
    powerKva: wd.powerKva ?? '',
    pollutionZone: wd.pollutionZone || '',
    vaastuCompliance: wd.vaastuCompliance === true || wd.vaastuCompliance === 'true',
    parkingDockingSpace: wd.parkingDockingSpace || '',
    photos: d.photos || '',
    media: getMediaFromWarehouse(d),
    // Newly added fields
    listing_type: d.listing_type || '',
    alt_phone_number: d.alt_phone_number || '',
    land_parcel_size: d.land_parcel_size || '',
    builtup_area: d.builtup_area || '',
    owner_warmnth: d.owner_warmnth || '',
    distance_from_highway: d.distance_from_highway || '',
    is_builder: d.is_builder === true || d.is_builder === 'true',
    owner_of_multiple_sites: d.owner_of_multiple_sites || '',
    carpet_area: d.carpet_area || '',
    nearest_transport: d.nearest_transport || '',
    fire_exits: d.fire_exits || '',
    fire_compliance_cert_type: d.fire_compliance_cert_type || '',
    washroom_count: d.washroom_count || '',
    ownerCompanyName: d.ownerCompanyName || '',
    ownerAltPoc: d.ownerAltPoc || '',
    gateSizeFt: d.gateSizeFt || '',
    dockApronLengthFt: d.dockApronLengthFt || '',
    setbackArea: d.setbackArea || '',
    ccRoads: d.ccRoads || '',
    wallAndSecurityRoom: d.wallAndSecurityRoom || '',
    plinthHeightFt: d.plinthHeightFt || '',
    dockDimension: d.dockDimension || '',
    canopyType: d.canopyType || '',
    dockPlatformType: d.dockPlatformType || '',
    otherDockingSpecs: d.otherDockingSpecs || '',
    flooringType: d.flooringType || '',
    floorStrengthPerSqm: d.floorStrengthPerSqm || '',
    ventilationType: d.ventilationType || '',
    insulationPresent: d.insulationPresent || '',
    insulationType: d.insulationType || '',
    lightingDetails: d.lightingDetails || '',
    centreHeight: d.centreHeight || '',
    cam: d.cam || '',
    chargeableArea: d.chargeableArea ?? '',
    scoutNotes: d.scoutNotes || '',
  };
};

// ── Reusable UI (JSX + CSS, no component library) ─────────────────────────────

const FormSteps = ({ steps, current, isMobile, onStepClick, canNavigateToStep }) => (
  <div className="form-steps-wrap">
    <div className="form-steps" role="list" aria-label="Form steps">
      {steps.map((s, i) => {
        const canNavigate = i !== current && canNavigateToStep(i);
        return (
          <div
            key={s.title}
            role="listitem"
            className={
              'form-steps__item'
              + (i < current ? ' form-steps__item--complete' : '')
              + (i === current ? ' form-steps__item--current' : '')
              + (i > current ? ' form-steps__item--todo' : '')
              + (canNavigate ? ' form-steps__item--clickable' : '')
            }
          >
            <button
              type="button"
              className="form-steps__badge"
              aria-current={i === current ? 'step' : undefined}
              aria-label={canNavigate ? `Go to ${s.title}` : s.title}
              disabled={!canNavigate}
              onClick={() => canNavigate && onStepClick(i)}
            >
              {i + 1}
            </button>
            {!isMobile && <span className="form-steps__title">{s.title}</span>}
          </div>
        );
      })}
    </div>
    {isMobile && <p className="form-steps__mobile-title">{steps[current]?.title}</p>}
  </div>
);

// Scroll to a form field, walking up to the nearest scrollable ancestor and
// computing the offset manually. Falls back to window scroll when the field
// lives in the document scroll context. Accepts a single field name or an
// array — when given an array, picks the field whose DOM element appears
// topmost in the document.
const scrollFieldIntoView = (fieldNameOrList) => {
  const names = Array.isArray(fieldNameOrList) ? fieldNameOrList : [fieldNameOrList];
  let el = null;
  let topY = Infinity;
  for (const name of names) {
    if (!name) continue;
    const candidate = document.querySelector(`[data-field="${name}"]`);
    if (!candidate) continue;
    const y = candidate.getBoundingClientRect().top;
    if (y < topY) { topY = y; el = candidate; }
  }
  if (!el) return;
  let container = el.parentElement;
  while (container && container !== document.body) {
    const style = window.getComputedStyle(container);
    if (/(auto|scroll)/.test(style.overflowY) && container.scrollHeight > container.clientHeight) break;
    container = container.parentElement;
  }
  if (container && container !== document.body) {
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const top = elRect.top - containerRect.top + container.scrollTop - (container.clientHeight / 2) + (elRect.height / 2);
    container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  } else {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  if (typeof el.focus === 'function') el.focus({ preventScroll: true });
};

const FormSpinner = ({ tip, large }) => (
  <div className={large ? 'form-spinner form-spinner--lg' : 'form-spinner'}>
    <div className="form-spinner__arc" aria-hidden />
    {tip && <p className="form-spinner__tip">{tip}</p>}
  </div>
);

const HelpTip = ({ text }) => (
  <span className="form-help" tabIndex={0}>
    <span className="form-help__icon" aria-hidden>?</span>
    <span className="form-help__tip" role="tooltip">{text}</span>
  </span>
);

const Field = ({ label, required, error, warning, children, style, tooltip }) => (
  <div className="form-field" style={style}>
    {label && (
      <label className="form-label">
        {label}
        {required && <span className="form-required"> *</span>}
        {tooltip && <HelpTip text={tooltip} />}
      </label>
    )}
    {children}
    {error && <div className="form-error">{error}</div>}
    {!error && warning && <div className="form-warning">{warning}</div>}
  </div>
);

const TextInput = ({ value, onChange, mobile: _m, placeholder, type = 'text', inputMode, maxLength, autoComplete, ...rest }) => (
  <input
    className="form-input"
    type={type}
    inputMode={inputMode}
    value={value ?? ''}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    maxLength={maxLength}
    autoComplete={autoComplete || 'off'}
    {...rest}
  />
);

const TextAreaInput = ({ value, onChange, mobile: _m, placeholder, rows = 3 }) => (
  <textarea
    className="form-input"
    value={value ?? ''}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
  />
);

const SelectInput = ({ value, onChange, mobile: _m, placeholder, options, ...rest }) => {
  // Preserve free-text values that don't match a predefined option, so an
  // existing entry is shown (and not silently overwritten) in edit mode while
  // the dropdown still lets the user switch to a standard option.
  const hasCustomValue = value != null && value !== '' && !options.includes(value);
  return (
    <select
      className="form-input"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      {...rest}
    >
      <option value="" disabled>{placeholder}</option>
      {hasCustomValue && <option value={value}>{value} (current)</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
};

const ComboBox = ({ value, onChange, options, placeholder, disabled, mobile: _m, ...rest }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()));

  const select = (opt) => {
    onChange(opt);
    setOpen(false);
    setQuery('');
  };

  const handleFocus = () => {
    if (!disabled) { setOpen(true); setQuery(''); }
  };

  const handleChange = (e) => {
    setQuery(e.target.value);
    setOpen(true);
  };

  return (
    <div ref={ref} className="combobox-wrap">
      <input
        className="form-input"
        value={open ? query : (value || '')}
        placeholder={disabled ? 'Select state first' : placeholder}
        disabled={!!disabled}
        onFocus={handleFocus}
        onChange={handleChange}
        autoComplete="off"
        readOnly={false}
        {...rest}
      />
      {open && filtered.length > 0 && (
        <ul className="combobox-list">
          {filtered.map(o => (
            <li
              key={o}
              className={`combobox-option${o === value ? ' combobox-option--selected' : ''}`}
              onMouseDown={() => select(o)}
            >
              {o}
            </li>
          ))}
        </ul>
      )}
      {open && !filtered.length && query && (
        <div className="combobox-empty">No matches for &quot;{query}&quot;</div>
      )}
    </div>
  );
};

const ToggleSwitch = ({ checked, onChange, yesLabel = 'Yes', noLabel = 'No' }) => (
  <div className="form-toggle-split" role="group" aria-label="Toggle">
    <button
      type="button"
      className={`form-toggle-split__btn${!checked ? ' is-active' : ''}`}
      onClick={() => onChange(false)}
    >
      {noLabel}
    </button>
    <button
      type="button"
      className={`form-toggle-split__btn${checked ? ' is-active' : ''}`}
      onClick={() => onChange(true)}
    >
      {yesLabel}
    </button>
  </div>
);

const Section = ({ title, children }) => (
  <section>
    <h2 className="form-section__title">{title}</h2>
    {children}
  </section>
);

// ── Main component ────────────────────────────────────────────────────────────

const DRAFT_STORAGE_KEY = 'warehouseForm:draft:v1';

const loadDraft = () => {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.values) return null;
    return parsed;
  } catch {
    return null;
  }
};

const saveDraft = (values, currentStep) => {
  try {
    localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({ values, currentStep, savedAt: Date.now() })
    );
  } catch {
    // Quota exceeded or storage unavailable — drop the draft silently.
  }
};

const clearDraft = () => {
  try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch { /* ignore */ }
};

const WarehouseForm = ({ visible, onCancel, onSubmit, initialData = null, loading = false }) => {
  const { isMobile } = useViewport();
  const [values, setValues] = useState(INITIAL_VALUES);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [draftRestored, setDraftRestored] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [submitReady, setSubmitReady] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Detect virtual keyboard via visualViewport so the sticky action bar can
  // hide only while the keyboard is actually up — not just while an input is
  // focused (Android back-button dismiss leaves focus but closes the keyboard).
  useEffect(() => {
    if (!isMobile || typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => {
      const occluded = window.innerHeight - vv.height;
      setKeyboardOpen(occluded > 150);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [isMobile]);

  // Anti-double-click protection for submit button
  useEffect(() => {
    if (currentStep === formSteps.length - 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSubmitReady(false);
      const t = setTimeout(() => setSubmitReady(true), 500);
      return () => clearTimeout(t);
    }
  }, [currentStep]);

  // Reset form when modal opens
  const [initialSnapshot, setInitialSnapshot] = useState(null);
  const [contactTouched, setContactTouched] = useState(false);
  useEffect(() => {
    if (visible) {
      // Only restore a draft when this is a brand-new form (no initialData edit context).
      const draft = !initialData ? loadDraft() : null;
      if (draft) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setValues({ ...INITIAL_VALUES, ...draft.values });
        setCurrentStep(Number.isInteger(draft.currentStep) ? draft.currentStep : 0);
        setDraftRestored(true);
      } else {
        setValues(toFormValues(initialData));
        setCurrentStep(0);
        setDraftRestored(false);
      }
      setErrors({});
      setInitialSnapshot(initialData);
      setContactTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Persist draft on change (debounced). Skip while editing an existing record.
  useEffect(() => {
    if (!visible || initialData) return;
    const t = setTimeout(() => saveDraft(values, currentStep), 400);
    return () => clearTimeout(t);
  }, [visible, initialData, values, currentStep]);

  // Patch in background-fetched contact number without resetting the form
  useEffect(() => {
    if (visible && !contactTouched && initialData && initialSnapshot &&
      initialData.id === initialSnapshot.id &&
      initialData.contactNumber !== initialSnapshot.contactNumber) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues(prev => ({ ...prev, contactNumber: initialData.contactNumber || prev.contactNumber }));
      setInitialSnapshot(initialData);
    }
  }, [visible, initialData, initialSnapshot, contactTouched]);

  const set = (field) => (val) => {
    setValues(prev => ({ ...prev, [field]: val }));
    if (field === 'contactNumber') setContactTouched(true);
    // Clear error on change
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  const setStateField = (val) => {
    const autoCity = val === 'Delhi' ? 'New Delhi' : val === 'Chandigarh' ? 'Chandigarh' : '';
    setValues(prev => ({ ...prev, state: val, city: autoCity }));
    setErrors(prev => ({ ...prev, state: null, city: null }));
  };

  // ── Validation ──────────────────────────────────────────────────────────────

  const getStepErrors = (stepIndex) => {
    const e = {};
    const fields = formSteps[stepIndex].fields;
    if (fields.includes('listing_type') && !values.listing_type) e.listing_type = 'Listing type is required';
    if (fields.includes('warehouseType') && !values.warehouseType?.trim()) e.warehouseType = 'Warehouse type is required';
    if (fields.includes('address') && !values.address?.trim()) e.address = 'Address is required';
    if (fields.includes('city') && !values.city?.trim()) e.city = 'City is required';
    if (fields.includes('state') && !values.state?.trim()) e.state = 'State is required';
    if (fields.includes('contactPerson') && !values.contactPerson?.trim()) e.contactPerson = 'Contact person is required';
    if (fields.includes('contactNumber')) {
      if (!values.contactNumber?.trim()) e.contactNumber = 'Contact number is required';
      else if (!looksLikePhone(values.contactNumber)) e.contactNumber = 'Enter a valid phone number (10-digit mobile, landline or +91 format)';
    }
    // Alternate phone is optional, but if provided it must look like a phone number.
    if (fields.includes('alt_phone_number') && values.alt_phone_number?.trim() && !looksLikePhone(values.alt_phone_number)) {
      e.alt_phone_number = 'Enter a valid phone number (10-digit mobile, landline or +91 format)';
    }
    if (fields.includes('totalSpaceSqft')) {
      const spaces = (values.totalSpaceSqft || []).filter(v => v != null && v !== '' && v > 0);
      if (spaces.length === 0) {
        e.totalSpaceSqft = 'At least one space value is required';
      } else if (spaces.some(v => !Number.isInteger(Number(v)))) {
        e.totalSpaceSqft = 'Space values must be whole numbers (no decimals)';
      }
    }
    if (fields.includes('ratePerSqft') && !values.ratePerSqft && values.ratePerSqft !== 0) e.ratePerSqft = 'Rate per sq ft is required';
    if (fields.includes('uploadedBy') && !values.uploadedBy?.trim()) e.uploadedBy = 'Uploaded by is required';
    if (fields.includes('compliances') && !values.compliances) e.compliances = 'Compliance info is required';

    if (fields.includes('chargeableArea') && values.chargeableArea !== '' && values.chargeableArea != null) {
      const n = Number(values.chargeableArea);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
        e.chargeableArea = 'Chargeable area must be a non-negative whole number';
      }
    }

    return e;
  };

  const validateStep = (stepIndex) => {
    const e = getStepErrors(stepIndex);
    const fields = formSteps[stepIndex].fields;

    setErrors(prev => {
      const newErrors = { ...prev };
      fields.forEach(f => delete newErrors[f]);
      return { ...newErrors, ...e };
    });

    if (Object.keys(e).length > 0) {
      const missingKeys = Object.keys(e);
      setTimeout(() => scrollFieldIntoView(missingKeys), 50);
      return false;
    }
    return true;
  };

  const canNavigateToStep = (stepIndex) => {
    if (stepIndex < 0 || stepIndex >= formSteps.length) return false;
    for (let i = 0; i < stepIndex; i += 1) {
      if (Object.keys(getStepErrors(i)).length > 0) return false;
    }
    return true;
  };

  const handleNext = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    setCurrentStep(prev => prev - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStepClick = (stepIndex) => {
    if (stepIndex === currentStep || !canNavigateToStep(stepIndex)) return;
    setCurrentStep(stepIndex);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Guard: only submit on the final step (Media). This prevents accidental
    // form submission when the user presses Enter on earlier steps, since all
    // steps are rendered in the DOM and the browser can find the submit button.
    if (currentStep !== formSteps.length - 1) return;
    if (!validateStep(currentStep)) return;
    if (mediaUploading) {
      setErrors(prev => ({ ...prev, _media: 'Please wait for media uploads to finish before submitting.' }));
      return;
    }

    setSubmitting(true);
    try {
      // Build media from form state (the FileUpload now manages a media object)
      const media = values.media || { images: [], videos: [], docs: [] };
      const hasMedia = (media.images?.length || 0) + (media.videos?.length || 0) + (media.docs?.length || 0) > 0;

      // Double-write: flatten media back to photos CSV for legacy column
      const allUrls = [...(media.images || []), ...(media.videos || []), ...(media.docs || [])];
      const photosValue = allUrls.length > 0 ? allUrls.join(',') : null;

      const payload = {
        warehouseOwnerType: values.warehouseOwnerType || null,
        warehouseType: values.warehouseType,
        address: values.address,
        googleLocation: values.googleLocation || null,
        city: values.city,
        state: values.state,
        postalCode: values.postalCode || null,
        contactPerson: values.contactPerson,
        contactNumber: values.contactNumber,
        totalSpaceSqft: (values.totalSpaceSqft || []).filter(v => v != null && v > 0),
        offeredSpaceSqft: values.offeredSpaceSqft ? String(values.offeredSpaceSqft) : null,
        numberOfDocks: values.numberOfDocks ? String(values.numberOfDocks) : null,
        clearHeightFt: values.clearHeightFt ? String(values.clearHeightFt) : null,
        compliances: values.compliances,
        otherSpecifications: values.otherSpecifications || null,
        ratePerSqft: values.ratePerSqft !== '' && values.ratePerSqft != null ? String(values.ratePerSqft) : null,
        availability: values.availability || null,
        uploadedBy: values.uploadedBy,
        isBroker: values.isBroker || null,
        photos: photosValue,
        media: hasMedia ? media : null,
        // Newly added fields (all optional)
        listing_type: values.listing_type || null,
        alt_phone_number: values.alt_phone_number || null,
        land_parcel_size: values.land_parcel_size || null,
        builtup_area: values.builtup_area || null,
        owner_warmnth: values.owner_warmnth || null,
        distance_from_highway: values.distance_from_highway || null,
        is_builder: typeof values.is_builder === 'boolean' ? values.is_builder : null,
        owner_of_multiple_sites: values.owner_of_multiple_sites || null,
        carpet_area: values.carpet_area || null,
        nearest_transport: values.nearest_transport || null,
        fire_exits: values.fire_exits || null,
        fire_compliance_cert_type: values.fire_compliance_cert_type || null,
        washroom_count: values.washroom_count || null,
        ownerCompanyName: values.ownerCompanyName || null,
        ownerAltPoc: values.ownerAltPoc || null,
        gateSizeFt: values.gateSizeFt || null,
        dockApronLengthFt: values.dockApronLengthFt || null,
        setbackArea: values.setbackArea || null,
        ccRoads: typeof values.ccRoads === 'boolean'
          ? (values.ccRoads ? 'true' : 'false')
          : (values.ccRoads || null),
        wallAndSecurityRoom: values.wallAndSecurityRoom || null,
        plinthHeightFt: values.plinthHeightFt || null,
        dockDimension: values.dockDimension || null,
        canopyType: values.canopyType || null,
        dockPlatformType: values.dockPlatformType || null,
        otherDockingSpecs: values.otherDockingSpecs || null,
        flooringType: values.flooringType || null,
        floorStrengthPerSqm: values.floorStrengthPerSqm || null,
        ventilationType: values.ventilationType || null,
        insulationPresent: typeof values.insulationPresent === 'boolean'
          ? (values.insulationPresent ? 'true' : 'false')
          : (values.insulationPresent || null),
        insulationType: values.insulationType || null,
        lightingDetails: values.lightingDetails || null,
        centreHeight: values.centreHeight || null,
        cam: values.cam || null,
        chargeableArea: values.chargeableArea === '' || values.chargeableArea == null
          ? null
          : Number(values.chargeableArea),
        scoutNotes: values.scoutNotes?.trim() || null,
        warehouseData: {
          fireNocAvailable: Boolean(values.fireNocAvailable),
          fireSafetyMeasures: values.fireSafetyMeasures || null,
          landType: values.landType || null,
          approachRoadWidth: values.approachRoadWidth ? String(values.approachRoadWidth) : null,
          parkingDockingSpace: values.parkingDockingSpace || null,
          pollutionZone: values.pollutionZone || null,
          powerKva: values.powerKva ? String(values.powerKva) : null,
          vaastuCompliance: typeof values.vaastuCompliance === 'boolean'
            ? (values.vaastuCompliance ? 'true' : 'false')
            : (values.vaastuCompliance || null),
        },
      };

      await onSubmit(payload);
      clearDraft();
      setDraftRestored(false);
      setValues(INITIAL_VALUES);
      setCurrentStep(0);
    } catch (err) {
      // Form data is preserved so the user can retry
      if (import.meta.env.DEV) console.error('Form submission error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = useCallback(() => {
    clearDraft();
    setDraftRestored(false);
    setValues(INITIAL_VALUES);
    setErrors({});
    clearErrors();
    onCancel();
  }, [onCancel]);

  const handleDiscardDraft = useCallback(() => {
    clearDraft();
    setDraftRestored(false);
    setValues(INITIAL_VALUES);
    setCurrentStep(0);
    setErrors({});
  }, []);

  // ── totalSpaceSqft list helpers ─────────────────────────────────────────────

  const addSpace = () => set('totalSpaceSqft')([...(values.totalSpaceSqft || []), '']);
  const removeSpace = (i) => set('totalSpaceSqft')(values.totalSpaceSqft.filter((_, idx) => idx !== i));
  const setSpace = (i, v) => {
    const next = [...values.totalSpaceSqft];
    next[i] = v === '' ? '' : Number(v);
    set('totalSpaceSqft')(next);
  };

  // ── Layout helpers ──────────────────────────────────────────────────────────

  const m = isMobile;
  const row = (children) => (
    <div className="form-row">{children}</div>
  );
  const col = (children, half = false) => (
    <div className={half && !m ? 'form-col form-col--half' : 'form-col'}>
      {children}
    </div>
  );

  if (!visible) return null;

  return (
    <div className={`warehouse-form-modal${m ? ' is-mobile' : ''}${keyboardOpen ? ' has-virtual-keyboard' : ''}`}>
      <div className={`warehouse-form-shell${loading || submitting ? ' is-busy' : ''}`}>
        {(loading || submitting) && (
          <div className="warehouse-form-overlay" aria-live="polite" aria-busy="true">
            <FormSpinner
              large={m}
              tip={submitting ? 'Saving warehouse...' : 'Loading...'}
            />
          </div>
        )}
        <form className="warehouse-form-inner" onSubmit={handleSubmit}>
          {draftRestored && (
            <div className="warehouse-form-draft-banner" role="status">
              <span>Restored unsaved draft from your last session.</span>
              <button
                type="button"
                className="warehouse-form-draft-banner__dismiss"
                onClick={() => setDraftRestored(false)}
              >
                Keep
              </button>
              <button
                type="button"
                className="warehouse-form-draft-banner__discard"
                onClick={handleDiscardDraft}
              >
                Discard draft
              </button>
            </div>
          )}
          <FormSteps
            steps={formSteps}
            current={currentStep}
            isMobile={m}
            onStepClick={handleStepClick}
            canNavigateToStep={canNavigateToStep}
          />

          {/* ── Owner Details ───────────────────────────────────── */}
          <div className={currentStep === 0 ? '' : 'step-hidden'}>
            <Section title="Owner Details">
              {row(<>
                {col(
                  <Field label="Listing Type" required error={errors.listing_type}>
                    <SelectInput mobile={m} value={values.listing_type} onChange={set('listing_type')} placeholder="Select listing type" options={['Rent', 'Sale']} data-field="listing_type" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Warehouse Owner Type">
                    <SelectInput mobile={m} value={values.warehouseOwnerType} onChange={set('warehouseOwnerType')} placeholder="Select owner type" options={OWNER_TYPES} data-field="warehouseOwnerType" />
                  </Field>,
                  true)}
              </>)}

              {row(<>
                {col(
                  <Field label="Owner Company Name" tooltip="Please specify details of company / 3PL.">
                    <TextInput mobile={m} value={values.ownerCompanyName} onChange={set('ownerCompanyName')} placeholder="Company name" />
                  </Field>,
                  true)}
              </>)}

              {row(<>
                {col(
                  <Field label="Contact Person" required error={errors.contactPerson}>
                    <TextInput mobile={m} value={values.contactPerson} onChange={set('contactPerson')} placeholder="Contact person name" autoComplete="name" data-field="contactPerson" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Contact Number" required error={errors.contactNumber}
                    warning={!looksLikePhone(values.contactNumber) ? "This doesn't look like a valid phone number. Use a 10-digit mobile, landline or +91 format." : null}>
                    <TextInput mobile={m} value={values.contactNumber} onChange={set('contactNumber')} placeholder="10-digit phone number" type="tel" inputMode="tel" maxLength={15} autoComplete="tel" data-field="contactNumber" />
                  </Field>,
                  true)}
              </>)}

              {row(<>
                {col(
                  <Field label="Alternate Phone Number" error={errors.alt_phone_number}
                    warning={!looksLikePhone(values.alt_phone_number) ? "This doesn't look like a valid phone number. Use a 10-digit mobile, landline or +91 format." : null}>
                    <TextInput mobile={m} value={values.alt_phone_number} onChange={set('alt_phone_number')} placeholder="Alternate phone" type="tel" inputMode="tel" maxLength={15} data-field="alt_phone_number" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Owner Alternate POC">
                    <TextInput mobile={m} value={values.ownerAltPoc} onChange={set('ownerAltPoc')} placeholder="Alternate point of contact" />
                  </Field>,
                  true)}
              </>)}

              {row(<>
                {col(
                  <Field label="Is Broker">
                    <ToggleSwitch checked={values.isBroker === true || values.isBroker === 'true' || values.isBroker === 'Yes'} onChange={(v) => set('isBroker')(v ? 'Yes' : 'No')} />
                  </Field>,
                  true)}
                {col(
                  <Field label="Is Builder">
                    <ToggleSwitch checked={values.is_builder} onChange={set('is_builder')} />
                  </Field>,
                  true)}
              </>)}

              {row(<>
                {col(
                  <Field label="Owner Warmth" tooltip="Rate the owner's personality. Green = positive and collaborative; Yellow = neutral; Red = hard to deal with.">
                    <SelectInput mobile={m} value={values.owner_warmnth} onChange={set('owner_warmnth')} placeholder="Select owner warmth" options={OWNER_WARMTH_OPTIONS} />
                  </Field>,
                  true)}
                {col(
                  <Field label="Owner of Multiple Sites">
                    <SelectInput mobile={m} value={values.owner_of_multiple_sites} onChange={set('owner_of_multiple_sites')} placeholder="Select Yes / No" options={['Yes', 'No']} />
                  </Field>,
                  true)}
              </>)}

              {row(
                col(
                  <Field label="Employee ID" required error={errors.uploadedBy} tooltip="Enter your Employee ID (empid) — this is used to authenticate your scout session.">
                    <TextInput mobile={m} value={values.uploadedBy} onChange={set('uploadedBy')} placeholder="e.g. VBHIWH" data-field="uploadedBy" />
                  </Field>,
                  true)
              )}
            </Section>
          </div>

          {/* ── Location Details ────────────────────────────────── */}
          <div className={currentStep === 1 ? '' : 'step-hidden'}>
            <Section title="Location Details">
              <Field label="Address" required error={errors.address} tooltip="Please mention the locality, but not the exact address.">
                <TextAreaInput mobile={m} value={values.address} onChange={set('address')} placeholder="Enter locality" rows={m ? 3 : 2} data-field="address" />
              </Field>

              {row(<>
                {col(
                  <Field label="State" required error={errors.state}>
                    <ComboBox mobile={m} value={values.state} onChange={setStateField} options={INDIA_STATES} placeholder="Select state" data-field="state" />
                  </Field>,
                  true)}
                {col(
                  <Field label="City" required error={errors.city}>
                    <ComboBox mobile={m} value={values.city} onChange={set('city')} options={INDIA_STATE_CITIES[values.state] || []} placeholder="Select city" disabled={!values.state} data-field="city" />
                  </Field>,
                  true)}
              </>)}

              {row(<>
                {col(
                  <Field label="Postal Code">
                    <TextInput mobile={m} value={values.postalCode} onChange={set('postalCode')} placeholder="Postal code" inputMode="numeric" autoComplete="postal-code" />
                  </Field>,
                  true)}
              </>)}

              <Field label="Google Location URL">
                <TextInput mobile={m} value={values.googleLocation} onChange={set('googleLocation')} placeholder="Google Maps URL" type="text" />
              </Field>

              {row(<>
                {col(
                  <Field label="Nearest Bus Transport" tooltip="Please mention the nearest bus stop and its distance.">
                    <TextInput mobile={m} value={values.nearest_transport} onChange={set('nearest_transport')} placeholder="Nearest bus stand / depot" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Distance from Highway">
                    <TextInput mobile={m} value={values.distance_from_highway} onChange={set('distance_from_highway')} placeholder="e.g. 2 km" />
                  </Field>,
                  true)}
              </>)}

              {row(<>
                {col(
                  <Field label="Approach Road Width (ft)">
                    <TextInput mobile={m} value={values.approachRoadWidth} onChange={set('approachRoadWidth')} placeholder="Road width" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Land Type">
                    <SelectInput mobile={m} value={values.landType} onChange={set('landType')} placeholder="Select land type" options={LAND_TYPES} />
                  </Field>,
                  true)}
              </>)}

              {row(
                col(
                  <Field label="Pollution Zone">
                    <SelectInput mobile={m} value={values.pollutionZone} onChange={set('pollutionZone')} placeholder="Select pollution zone" options={POLLUTION_ZONES} />
                  </Field>,
                  true)
              )}
            </Section>
          </div>

          {/* ── Warehouse Technical Specifications ──────────────── */}
          <div className={currentStep === 2 ? '' : 'step-hidden'}>
            <Section title="Warehouse Technical Specifications">
              {row(
                col(
                  <Field label="Warehouse Type" required error={errors.warehouseType} tooltip="Please mention PEB / RCC / Shed. Use 'Shed' for old-style godowns.">
                    <SelectInput mobile={m} value={values.warehouseType} onChange={set('warehouseType')} placeholder="Select warehouse type" options={WAREHOUSE_TYPES} data-field="warehouseType" />
                  </Field>,
                  true)
              )}

              {row(<>
                {col(
                  /* NOTE: 'totalSpaceSqft' from the schema is displayed as "Offered Area" here per user request */
                  <Field label="Offered Area (sq ft)" required error={errors.totalSpaceSqft} tooltip="Please mention all kinds of areas offered, including partition possibilities.">
                    {(values.totalSpaceSqft || []).map((v, i) => (
                      <div key={i} className="form-inline-row">
                        <input
                          type="text"
                          className="form-input"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={v ?? ''}
                          onChange={e => setSpace(i, e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="Enter space"
                          data-field="totalSpaceSqft"
                        />
                        {values.totalSpaceSqft.length > 1 && (
                          <button
                            type="button"
                            className="form-icon-btn"
                            onClick={() => removeSpace(i)}
                            aria-label="Remove space value"
                          >
                            −
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={addSpace} className="form-btn form-btn--dashed">
                      + Add Space Value
                    </button>
                  </Field>,
                  true)}
                {col(
                  <Field label="Chargeable Area (sq ft)" error={errors.chargeableArea} tooltip="The billable area used to compute rent.">
                    <TextInput mobile={m} value={values.chargeableArea} onChange={v => set('chargeableArea')(String(v).replace(/[^0-9]/g, ''))} placeholder="Chargeable area" type="text" inputMode="numeric" pattern="[0-9]*" data-field="chargeableArea" />
                  </Field>,
                  true)}
              </>)}

              {row(<>
                {col(
                  <Field label="Land Parcel Size" tooltip="Please mention the entire parcel size.">
                    <TextInput mobile={m} value={values.land_parcel_size} onChange={set('land_parcel_size')} placeholder="e.g. 5 acres" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Built-up Area" tooltip="Please mention the entire compound's built-up area.">
                    <TextInput mobile={m} value={values.builtup_area} onChange={set('builtup_area')} placeholder="Built-up area" />
                  </Field>,
                  true)}
              </>)}

              {row(
                col(
                  <Field label="Carpet Area" tooltip="Please mention the entire carpet area.">
                    <TextInput mobile={m} value={values.carpet_area} onChange={set('carpet_area')} placeholder="Carpet area" />
                  </Field>,
                  true)
              )}

              {row(<>
                {col(
                  <Field label="Clear Height (ft)" tooltip="Please mention the side height here.">
                    <TextInput mobile={m} value={values.clearHeightFt} onChange={set('clearHeightFt')} placeholder="Clear Height / Side Height" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Centre Height">
                    <TextInput mobile={m} value={values.centreHeight} onChange={set('centreHeight')} placeholder="Centre height" />
                  </Field>,
                  true)}
              </>)}

              {row(<>
                {col(
                  <Field label="Plinth Height (ft)">
                    <TextInput mobile={m} value={values.plinthHeightFt} onChange={set('plinthHeightFt')} placeholder="Plinth height / Dock Height" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Number of Docks">
                    <TextInput mobile={m} value={values.numberOfDocks} onChange={set('numberOfDocks')} placeholder="Number of docks" />
                  </Field>,
                  true)}
              </>)}

              {row(<>
                {col(
                  <Field label="Dock Dimension (ft)">
                    <TextInput mobile={m} value={values.dockDimension} onChange={set('dockDimension')} placeholder="e.g. 8x10 ft" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Canopy Type">
                    <TextInput mobile={m} value={values.canopyType} onChange={set('canopyType')} placeholder="Running/Shutter/None" />
                  </Field>,
                  true)}
              </>)}

              {row(<>
                {col(
                  <Field label="Dock Apron Length (ft)" tooltip="Please mention the distance from the wall to the dock platform for truck movement.">
                    <TextInput mobile={m} value={values.dockApronLengthFt} onChange={set('dockApronLengthFt')} placeholder="Distance from Dock to Wall in ft" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Dock Platform Type">
                    <TextInput mobile={m} value={values.dockPlatformType} onChange={set('dockPlatformType')} placeholder="None/Extended Platform/Running Platform/Cross Dock" />
                  </Field>,
                  true)}
              </>)}

              {row(<>
                {col(
                  <Field label="Compound Gate Width (ft)">
                    <TextInput mobile={m} value={values.gateSizeFt} onChange={set('gateSizeFt')} placeholder="Gate Width" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Setback Area" tooltip="Setback area around the box.">
                    <TextInput mobile={m} value={values.setbackArea} onChange={set('setbackArea')} placeholder="e.g. 5m on all sides" />
                  </Field>,
                  true)}
              </>)}

              <Field label="Other Docking Specs" tooltip="Please mention if cross docks, levellers, or other specs are present.">
                <TextAreaInput mobile={m} value={values.otherDockingSpecs} onChange={set('otherDockingSpecs')} placeholder="Other docking specifications" rows={m ? 3 : 2} />
              </Field>

              {row(
                col(
                  <Field label="CC Roads" tooltip="Are there concrete roads around the warehouse?">
                    <ToggleSwitch checked={values.ccRoads === true || values.ccRoads === 'true' || values.ccRoads === 'Yes'} onChange={(v) => set('ccRoads')(v)} />
                  </Field>,
                  true)
              )}

              {row(<>
                {col(
                  <Field label="Flooring Type">
                    <TextInput mobile={m} value={values.flooringType} onChange={set('flooringType')} placeholder="VDF/FM2" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Floor Strength (per sqm)">
                    <TextInput mobile={m} value={values.floorStrengthPerSqm} onChange={set('floorStrengthPerSqm')} placeholder="e.g. 5 T/sqm" />
                  </Field>,
                  true)}
              </>)}

              {row(
                col(
                  <Field label="Ventilation Type" tooltip="Ridge / Turbo / Side Louvers / Windows. Fill what is relevant.">
                    <TextInput mobile={m} value={values.ventilationType} onChange={set('ventilationType')} placeholder="Ridge/Turbo" />
                  </Field>,
                  true)
              )}

              {row(<>
                {col(
                  <Field label="Insulation Present">
                    <ToggleSwitch checked={values.insulationPresent === true || values.insulationPresent === 'true' || values.insulationPresent === 'Yes'} onChange={(v) => set('insulationPresent')(v)} />
                  </Field>,
                  true)}
                {col(
                  <Field label="Insulation Type">
                    <TextInput mobile={m} value={values.insulationType} onChange={set('insulationType')} placeholder="Insulation type" />
                  </Field>,
                  true)}
              </>)}

              {row(<>
                {col(
                  <Field label="Lighting Details" tooltip="Please mention LUX level, else the type of lighting provided.">
                    <TextInput mobile={m} value={values.lightingDetails} onChange={set('lightingDetails')} placeholder="Lux Level" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Power (KVA)">
                    <TextInput mobile={m} value={values.powerKva} onChange={set('powerKva')} placeholder="Power in KVA" />
                  </Field>,
                  true)}
              </>)}

              <Field label="Parking Space Availability">
                <TextAreaInput mobile={m} value={values.parkingDockingSpace} onChange={set('parkingDockingSpace')} placeholder="Mention area for seperate parking if available" rows={m ? 3 : 2} />
              </Field>

              {row(<>
                {col(
                  <Field label="Washroom Count">
                    <TextInput mobile={m} value={values.washroom_count} onChange={set('washroom_count')} placeholder="Number of washrooms" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Security Features">
                    <TextInput mobile={m} value={values.wallAndSecurityRoom} onChange={set('wallAndSecurityRoom')} placeholder="eg: Security Room, CCTV etc" />
                  </Field>,
                  true)}
              </>)}

              <Field label="Other Specifications">
                <TextAreaInput mobile={m} value={values.otherSpecifications} onChange={set('otherSpecifications')} placeholder="Other specifications" rows={m ? 3 : 2} />
              </Field>
            </Section>
          </div>

          {/* ── Compliances ─────────────────────────────────────── */}
          <div className={currentStep === 3 ? '' : 'step-hidden'}>
            <Section title="Compliances">
              <Field label="Compliances" required error={errors.compliances}>
                <TextAreaInput mobile={m} value={values.compliances} onChange={set('compliances')} placeholder="Please only mention conversion-related and Fire NOC-related status." rows={m ? 3 : 2} />
              </Field>

              {row(<>
                {col(
                  <Field label="Fire Exits">
                    <TextInput mobile={m} value={values.fire_exits} onChange={set('fire_exits')} placeholder="Number of Fire Exits" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Fire NOC Available">
                    <ToggleSwitch checked={values.fireNocAvailable} onChange={set('fireNocAvailable')} />
                  </Field>,
                  true)}
              </>)}

              {row(
                col(
                  <Field label="Fire Safety Measures">
                    <TextInput mobile={m} value={values.fireSafetyMeasures} onChange={set('fireSafetyMeasures')} placeholder="eg: Hydrants, Sprinklers etc" />
                  </Field>,
                  true)
              )}

              {row(<>
                {col(
                  <Field label="Fire Compliance Certification Type" tooltip="E.g. in Bangalore there is Fire Advisory, or Fire NOC.">
                    <TextInput mobile={m} value={values.fire_compliance_cert_type} onChange={set('fire_compliance_cert_type')} placeholder="Fire Compliance Certifications" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Vaastu Compliance">
                    <ToggleSwitch checked={values.vaastuCompliance} onChange={set('vaastuCompliance')} />
                  </Field>,
                  true)}
              </>)}

            </Section>
          </div>

          {/* ── Commercials ─────────────────────────────────────── */}
          <div className={currentStep === 4 ? '' : 'step-hidden'}>
            <Section title="Commercials">
              {row(
                col(
                  <Field label="Rate per sq ft" required error={errors.ratePerSqft}>
                    <TextInput mobile={m} value={values.ratePerSqft} onChange={set('ratePerSqft')} placeholder="Rate per sq ft" data-field="ratePerSqft" />
                  </Field>,
                  true)
              )}

              {row(
                col(
                  <Field label="CAM" tooltip="Common Area Maintenance charges.">
                    <TextInput mobile={m} value={values.cam} onChange={set('cam')} placeholder="CAM charges" />
                  </Field>,
                  true)
              )}

              {row(
                col(
                  <Field label="Availability">
                    <TextInput mobile={m} value={values.availability} onChange={set('availability')} placeholder="Please mention the date of availability." />
                  </Field>,
                  true)
              )}
            </Section>
          </div>

          {/* ── Media ────────────────────────────────────────── */}
          <div className={currentStep === 5 ? '' : 'step-hidden'}>
            <Section title="Media">
              <Field label="Upload Files, Layout, Images and Videos">
                <FileUpload value={values.media} onChange={set('media')} onUploadingChange={setMediaUploading} uploadedBy={values.uploadedBy} />
              </Field>
            </Section>
          </div>

          {/* ── Scout Notes ──────────────────────────────────── */}
          <div className={currentStep === 6 ? '' : 'step-hidden'}>
            <Section title="Scout Notes">
              <Field label="Notes">
                <div className="scout-notes-area">
                  <TextAreaInput
                    mobile={m}
                    value={values.scoutNotes}
                    onChange={set('scoutNotes')}
                    placeholder="Extra notes from the visit — field observations, client suitability, or anything else worth mentioning."
                    rows={m ? 10 : 8}
                  />
                </div>
              </Field>
            </Section>
          </div>

          {/* ── Actions ─────────────────────────────────────────── */}
          {mediaUploading && currentStep === formSteps.length - 1 && (
            <div className="warehouse-form-upload-warning" role="status">
              Media is still uploading — submit will be enabled once it completes.
            </div>
          )}
          <div className={m ? 'form-actions form-actions--stack' : 'form-actions'}>
            <button type="button" className="form-btn form-btn--ghost form-btn--cancel" onClick={handleCancel}>
              Cancel
            </button>
            {currentStep > 0 && (
              <button type="button" className="form-btn form-btn--ghost form-btn--prev" onClick={handlePrev}>
                Previous
              </button>
            )}
            {currentStep < formSteps.length - 1 && (
              <button key="next-btn" type="button" className="form-btn form-btn--primary" onClick={handleNext}>
                Next
              </button>
            )}
            {currentStep === formSteps.length - 1 && (
              <button
                key="submit-btn"
                type="submit"
                className="form-btn form-btn--primary"
                disabled={loading || submitting || mediaUploading || !submitReady}
                title={mediaUploading ? 'Waiting for media uploads to finish' : !submitReady ? 'Wait a moment...' : undefined}
              >
                {submitting
                  ? (m ? 'Saving...' : 'Saving')
                  : mediaUploading
                    ? 'Uploading media…'
                    : `${initialData ? 'Update' : 'Create'} Warehouse`}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default WarehouseForm;

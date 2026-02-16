// Add this to your Sidebar component or navigation config

export const mastersMenuItems = [
  {
    id: 'masters',
    label: 'Masters',
    icon: 'Database', // or your icon component
    children: [
      {
        id: 'doctors',
        label: 'Doctors',
        path: '/masters/doctors',
        icon: 'Stethoscope',
      },
      {
        id: 'specialties',
        label: 'Specialties',
        path: '/masters/specialties',
        icon: 'ClipboardList',
      },
      // Add more master tables here later
      // {
      //   id: 'patients',
      //   label: 'Patients',
      //   path: '/masters/patients',
      //   icon: 'Users',
      // },
    ],
  },
];

// Example Sidebar component integration
/*
import { mastersMenuItems } from './mastersMenu';

function Sidebar() {
  return (
    <aside className="w-64 bg-gray-800 text-white">
      <nav>
        {mastersMenuItems.map((section) => (
          <div key={section.id}>
            <div className="px-4 py-2 font-semibold">
              {section.label}
            </div>
            {section.children?.map((item) => (
              <Link
                key={item.id}
                to={item.path}
                className="block px-6 py-2 hover:bg-gray-700"
              >
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
*/
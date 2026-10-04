// import { useSession } from 'next-auth/client';
// import { Row } from 'react-bootstrap';
// import i18n from '../services/i18n';

// export const withAuth = (Component, msg?: string) => (props) => {
//   const [session, loading] = useSession();

//   if (loading) {
//     return <h2>{i18n('loading...')}</h2>;
//   }
//   return session ? (
//     <Component {...props} />
//   ) : (
//     <Row className="container p-5">
//       <h1
//         style={{
//           textAlign: 'center',
//           position: 'fixed',
//           top: '50vh',
//         }}
//       >
//         {msg || i18n('Not authorized')}
//       </h1>
//     </Row>
//   );
// };

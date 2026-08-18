const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'ykcrngqhyinczmvwduox';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  throw new Error('Missing SUPABASE_ACCESS_TOKEN');
}

const BRAND_DESCRIPTIONS = {
  'age-no-more': `Age No More là nhóm thương hiệu nổi bật trong danh mục chăm sóc da chống lão hóa và phục hồi của Thế Giới Trị Mụn. Ở catalog hiện tại, thương hiệu này tập trung vào serum tế bào gốc, kem dưỡng phục hồi, kem mắt và các sản phẩm cấp ẩm chuyên sâu cho làn da đang cần nuôi dưỡng đều đặn.

Trang thương hiệu Age No More được xây dựng để khách hàng nhìn nhanh toàn bộ các dòng đang có mặt trên website, từ chăm sóc mắt đến phục hồi hàng ngày. Nếu bạn đang tìm một brand thiên về dưỡng da trưởng thành, cải thiện độ đàn hồi và duy trì cảm giác da khỏe hơn sau giai đoạn stress hoặc treatment, Age No More là nhóm sản phẩm nên xem trước tiên.`,
  'aotearoa-vitality': `Aotearoa Vitality tại Thế Giới Trị Mụn hiện được giới thiệu như một thương hiệu thiên về giải pháp chăm sóc sức khỏe chủ động cho trẻ em và gia đình. Danh mục đang có trên website tập trung vào sản phẩm hỗ trợ tăng trưởng, giúp phụ huynh dễ chọn dòng phù hợp với nhu cầu phát triển thể chất hằng ngày của trẻ.

Trang thương hiệu này phù hợp với khách hàng muốn xem nhanh toàn bộ sản phẩm Aotearoa Vitality đang bán, đọc mô tả gọn nhưng đủ định hướng trước khi đi vào chi tiết từng sản phẩm. Thế Giới Trị Mụn giữ cách giới thiệu rõ ràng, thiên về công dụng thực tế và lối sử dụng dễ hiểu để phụ huynh chọn mua nhanh hơn.`,
  'aromase': `Aromase là một trong những thương hiệu nổi bật của Thế Giới Trị Mụn ở nhóm chăm sóc da đầu và tóc. Catalog hiện tại xoay quanh dầu gội làm sạch sâu, sản phẩm hỗ trợ giảm gàu, giảm kích ứng da đầu, bộ chăm sóc Medipro và các giải pháp dành cho khách hàng đang quan tâm đến da đầu nhạy cảm hoặc tóc thưa yếu.

Điểm mạnh của trang thương hiệu Aromase là giúp bạn nhìn thấy rõ từng hướng sản phẩm: làm sạch, hỗ trợ giảm viêm da đầu, cải thiện cảm giác bết ngứa và chăm sóc mật độ tóc. Nếu mục tiêu của bạn không chỉ là làm sạch tóc mà còn là tối ưu sức khỏe da đầu lâu dài, đây là thương hiệu rất đáng xem kỹ.`,
  'biohoney': `Biohoney tại Thế Giới Trị Mụn là nhóm thương hiệu kết hợp giữa chăm sóc da và các sản phẩm nổi bật từ mật ong hoặc nọc ong. Trên website hiện có kem dưỡng cho da mụn, kem vitamin E, mặt nạ bee venom và một số sản phẩm mật ong nguyên chất, tạo nên một danh mục khá khác biệt so với phần còn lại của nhà thuốc.

Trang thương hiệu Biohoney phù hợp với khách hàng muốn tìm những lựa chọn thiên về nuôi dưỡng, làm mềm da và chăm sóc nền da khô hoặc dễ xỉn màu. Việc gom tất cả sản phẩm Biohoney vào cùng một trang cũng giúp bạn so sánh nhanh giữa nhóm skincare bôi ngoài da và nhóm sản phẩm hỗ trợ chăm sóc sức khỏe hàng ngày.`,
  'deep-blue-health': `Deep Blue Health là thương hiệu có độ phủ rất rộng trên Thế Giới Trị Mụn, từ chăm sóc tóc, hỗ trợ da mụn, sản phẩm từ hạt gai dầu cho tới nhóm mật ong Manuka và thực phẩm bổ sung. Đây là một trong những brand có danh mục sâu nhất trên website, phù hợp với khách hàng muốn giải quyết nhiều nhu cầu cùng lúc trong một hệ sinh thái sản phẩm.

Ở trang thương hiệu Deep Blue Health, bạn có thể đi nhanh từ các nhóm topical như dầu gội, gel mụn, serum sang các sản phẩm hỗ trợ từ bên trong như protein, viên uống hay kẹo ngậm. Cách tổ chức này đặc biệt hữu ích cho khách hàng muốn xây dựng routine toàn diện thay vì chỉ mua lẻ từng món riêng rẽ.`,
  'dermeden': `DermEden là thương hiệu được Thế Giới Trị Mụn định vị ở nhóm dược mỹ phẩm chăm sóc da chuyên sâu, nổi bật với chống nắng, dưỡng sáng, dưỡng ẩm và chống lão hóa. Danh mục hiện có trên website khá đa dạng, bao gồm cả size tiêu chuẩn và một số sample giúp khách hàng dễ thử kết cấu trước khi mua full size.

Trang thương hiệu DermEden phù hợp với người dùng muốn tìm một routine rõ ràng cho ban ngày và ban đêm, đặc biệt là các sản phẩm xoay quanh bảo vệ da trước ánh nắng, cải thiện độ đều màu và duy trì cảm giác da ẩm khỏe. Nếu bạn ưu tiên một brand có cấu trúc sản phẩm mạch lạc và dễ ghép routine, DermEden là lựa chọn đáng cân nhắc.`,
  'earths-kitchen': `Earth’s Kitchen là thương hiệu đang được Thế Giới Trị Mụn giới thiệu ở nhóm chống nắng dịu nhẹ và ưu tiên sự thoải mái trên da. Các sản phẩm hiện có tập trung vào kem chống nắng hướng tới da nhạy cảm, dễ dùng hằng ngày và phù hợp với khách hàng muốn một lựa chọn gọn, dễ hiểu, không quá phức tạp.

Trang thương hiệu này đặc biệt hữu ích nếu bạn muốn đi thẳng vào các dòng chống nắng Earth’s Kitchen đang có mặt trên website mà không phải lọc thêm nhiều bước. Đây là nhóm brand phù hợp cho khách hàng đề cao tính tối giản, cảm giác lành da và nhu cầu sử dụng chống nắng đều đặn mỗi ngày.`,
  'easiyo': `EasiYo tại Thế Giới Trị Mụn đại diện cho nhóm sản phẩm thiên về dinh dưỡng tiện lợi, đặc biệt là máy làm sữa chua và các dòng sữa chua vị khác nhau. Thương hiệu này mang lại trải nghiệm khá khác biệt so với nhóm dược mỹ phẩm, phù hợp với khách hàng quan tâm đến thói quen ăn uống và bổ sung men lợi khuẩn tại nhà.

Trang thương hiệu EasiYo giúp bạn xem nhanh cả thiết bị và nguyên liệu đi kèm trong cùng một không gian. Với cách gom nhóm này, khách hàng có thể bắt đầu từ máy làm sữa chua, sau đó chọn tiếp các vị phù hợp mà không phải tìm kiếm rời rạc qua nhiều danh mục khác nhau.`,
  'evolsense': `Evolsense trên Thế Giới Trị Mụn hiện được giới thiệu với dòng sản phẩm thiên về enzyme và hỗ trợ cân bằng tiêu hóa. Danh mục chưa quá rộng, nhưng đủ rõ để khách hàng nhanh chóng nhận biết đây là thương hiệu tập trung vào giải pháp uống tiện dụng cho người cần kiểm soát chế độ ăn và cảm giác tiêu hóa nhẹ nhàng hơn.

Trang thương hiệu Evolsense phù hợp với khách hàng muốn xem nhanh toàn bộ sản phẩm đang có và đọc trước định hướng sử dụng của brand. Khi thương hiệu còn ít SKU, một landing page riêng sẽ giúp quyết định mua nhanh hơn vì toàn bộ thông tin cốt lõi đã được gom lại ở một chỗ.`,
  'foria': `Foria là thương hiệu được Thế Giới Trị Mụn xếp vào nhóm chăm sóc đời sống riêng tư và cảm giác cơ thể, với các sản phẩm dầu, viên đặt hoặc giải pháp bôi ngoài có định hướng rõ ràng cho wellness cá nhân. Catalog hiện tại tập trung vào nhóm sản phẩm dành cho sự thoải mái, độ ẩm và trải nghiệm thân mật.

Trang thương hiệu Foria được thiết kế để khách hàng đọc mô tả brand theo cách kín đáo nhưng đầy đủ, sau đó đi thẳng vào các sản phẩm phù hợp. Đây là cách trình bày cần thiết với nhóm hàng mang tính cá nhân cao, giúp người mua dễ hiểu sản phẩm mà vẫn giữ được cảm giác riêng tư và dễ tiếp cận.`,
  'harker-herbals': `Harker Herbals là thương hiệu nổi bật của Thế Giới Trị Mụn trong nhóm sản phẩm thảo dược, siro, hỗ trợ miễn dịch và chăm sóc hệ tiêu hóa cho cả trẻ em lẫn người lớn. Website hiện đang có nhiều SKU xoay quanh vitamin C, bổ sung sắt, cân bằng hệ vi sinh và các dòng hỗ trợ sức khỏe hằng ngày.

Trang thương hiệu Harker Herbals phù hợp với khách hàng muốn gom toàn bộ nhóm siro, men và sản phẩm thảo dược vào một nơi để so sánh nhanh. Với các gia đình cần lựa chọn cho nhiều độ tuổi khác nhau, cách trình bày theo brand giúp tiết kiệm thời gian hơn rất nhiều so với tìm sản phẩm rời rạc từng danh mục.`,
  'hemptuary': `Hemptuary tại Thế Giới Trị Mụn hiện được giới thiệu như một brand chăm sóc da và cơ thể từ hạt gai dầu, tập trung vào dưỡng ẩm, làm sạch dịu nhẹ và những sản phẩm dễ đưa vào routine hằng ngày. Dòng hàng trên website chưa quá rộng nhưng có bản sắc rõ ràng, phù hợp với khách hàng thích các lựa chọn mềm da, thân thiện và dễ dùng.

Trang thương hiệu Hemptuary giúp bạn theo dõi nhanh các sản phẩm đang có như kem dưỡng ẩm hoặc xà phòng làm sạch, đồng thời kết nối thương hiệu này với các nhu cầu chăm sóc da cơ bản. Đây là lựa chọn hợp lý cho người ưu tiên sự đơn giản, cảm giác dễ chịu và muốn một brand có định hướng nhất quán.`,
  'kolorex': `Kolorex là thương hiệu được Thế Giới Trị Mụn xây dựng mạnh ở nhóm chăm sóc vùng kín và cân bằng hệ vi sinh tại chỗ. Trên website hiện có nhiều sản phẩm rửa, gel, kem chăm sóc và các bộ combo, phù hợp với khách hàng muốn chọn theo nhu cầu rất cụ thể thay vì tự ghép lẻ từng món.

Trang thương hiệu Kolorex đóng vai trò như một landing page định hướng, giúp khách hàng nhìn ra ngay các nhóm sản phẩm chính và đi thẳng đến danh mục đã lọc. Với những người đang ưu tiên sự dịu nhẹ, vệ sinh hàng ngày và cảm giác dễ chịu ở vùng da nhạy cảm, Kolorex là brand nên được khám phá theo bộ thay vì mua ngẫu nhiên từng sản phẩm.`,
  'lavior': `Lavior tại Thế Giới Trị Mụn là thương hiệu nổi bật ở nhóm chăm sóc vết thương, hỗ trợ bảo vệ da tổn thương và các giải pháp dành cho bàn chân hoặc vùng da cần chăm sóc kỹ hơn. Các sản phẩm hiện có trải dài từ hydrogel, gel bôi cho vết thương hở đến các dòng hỗ trợ chăm sóc cho người có nguy cơ loét hoặc da chậm lành.

Trang thương hiệu Lavior giúp người dùng đi thẳng vào đúng nhóm sản phẩm cần thiết mà không bị nhiễu bởi các danh mục làm đẹp thông thường. Đây là brand nên được xem kỹ khi nhu cầu của bạn nghiêng về chăm sóc tổn thương, phục hồi bề mặt da và duy trì quy trình chăm sóc thực tế tại nhà.`,
  'lifestream': `Lifestream là một trong những thương hiệu mạnh của Thế Giới Trị Mụn ở nhóm men vi sinh và hỗ trợ sức khỏe chuyển hóa, tiêu hóa, miễn dịch. Catalog hiện tại có nhiều sản phẩm dành cho các nhu cầu khác nhau như cân bằng hệ vi sinh, hỗ trợ tâm trạng, hỗ trợ tiêu hóa và một số dòng dành cho trẻ em.

Trang thương hiệu Lifestream giúp khách hàng có cái nhìn hệ thống hơn về một brand vốn có khá nhiều SKU và nhiều hướng sử dụng. Khi mọi sản phẩm được gom lại trong một landing page riêng, việc chọn đúng dòng men phù hợp với mục tiêu cá nhân sẽ nhanh và rõ ràng hơn nhiều.`,
  'living-nature': `Living Nature tại Thế Giới Trị Mụn đại diện cho nhóm skincare thiên nhiên với danh mục khá sâu: dầu dưỡng, gel dưỡng, sản phẩm cấp ẩm và các giải pháp chăm sóc da mặt dùng hằng ngày. Đây là brand phù hợp với khách hàng muốn xây routine nhẹ nhàng nhưng vẫn có nhiều lựa chọn theo từng bước chăm sóc.

Trang thương hiệu Living Nature giúp bạn đi từ tổng quan sang lựa chọn cụ thể theo nhu cầu như cấp ẩm, cân bằng hay dưỡng da ban ngày và ban đêm. Với khách hàng yêu thích chất skincare dịu da, có thiên hướng nuôi dưỡng nền da đều đặn, Living Nature là một brand đáng xem kỹ trên website.`,
  'madeleine-ritchie': `Madeleine Ritchie là thương hiệu được Thế Giới Trị Mụn giới thiệu nổi bật trong nhóm dưỡng da với mật ong Manuka, royal jelly và các công thức giàu cảm giác nuôi dưỡng. Danh mục đang có trên website bao gồm kem ngày, kem đêm, kem mắt và một số sản phẩm chăm sóc da chuyên về độ mềm, độ ẩm và cảm giác da khỏe hơn sau thời gian dài thiếu chăm sóc.

Trang thương hiệu Madeleine Ritchie phù hợp với khách hàng thích các sản phẩm có hướng dưỡng rõ ràng, dễ dùng đều mỗi ngày và ưu tiên trải nghiệm da mềm, ẩm và dễ chịu. Đây là nhóm brand phù hợp cho người muốn xây một routine nuôi dưỡng cổ điển, ổn định và dễ theo dõi.`,
  'manuka-biotic': `Manuka Biotic là thương hiệu đang được Thế Giới Trị Mụn giới thiệu ở hai nhóm nhu cầu khá rõ: chăm sóc da đầu nhạy cảm và chăm sóc da với hoạt chất/nguồn gốc từ Manuka. Danh mục hiện có trên website bao gồm dầu gội, dầu xả cho da đầu nhạy cảm, tinh dầu Manuka và một số dòng kem dưỡng.

Điểm mạnh của trang thương hiệu Manuka Biotic là gom các sản phẩm liên quan về cùng một triết lý chăm sóc: dịu nhẹ, ưu tiên nền da và da đầu dễ kích ứng. Nếu bạn đang muốn tìm một brand có thể đi cùng cả nhu cầu scalp care lẫn skincare dịu nhẹ, Manuka Biotic là lựa chọn rất đáng để đọc kỹ trước khi mua.`,
  'nz-sunscreen-company': `NZ Sunscreen Company tại Thế Giới Trị Mụn tập trung rõ vào nhóm chống nắng hằng ngày và chăm sóc da sau nắng. Những sản phẩm đang có trên website chủ yếu xoay quanh dòng Pure Shade SPF 50+, nhắm đến người dùng muốn vừa bảo vệ da, vừa duy trì cảm giác ẩm mượt và dễ chịu khi dùng mỗi ngày.

Trang thương hiệu này giúp khách hàng nhìn nhanh toàn bộ các lựa chọn chống nắng của brand, từ size nhỏ đến size tiêu chuẩn, đồng thời kết nối với các sản phẩm hỗ trợ làm sáng hoặc làm dịu sau nắng. Với khách hàng cần một brand chuyên về chống nắng thay vì danh mục quá rộng, đây là điểm bắt đầu hợp lý.`,
  'nzpurehealthcom': `Nzpurehealth.com là thương hiệu trên Thế Giới Trị Mụn thiên về thực phẩm bổ sung và chăm sóc sức khỏe chủ động, với danh mục khá rộng từ omega 3, CoQ10, ginkgo biloba tới detox và các dòng hỗ trợ tim mạch, trí nhớ hoặc thị lực. Đây là nhóm brand phù hợp với khách hàng muốn mua theo mục tiêu sức khỏe rõ ràng.

Trang thương hiệu Nzpurehealth.com giúp rút ngắn thời gian tìm kiếm bằng cách gom toàn bộ các sản phẩm cùng brand vào một chỗ. Khi số lượng SKU tăng lên, một landing page riêng giúp người dùng dễ so sánh hơn giữa các hướng hỗ trợ như não bộ, tim mạch, chống oxy hóa hay chăm sóc cơ thể tổng quát.`,
  'scarguard': `Scarguard tại Thế Giới Trị Mụn được định vị ở nhóm chăm sóc sẹo, thâm, nám và các dấu vết sau tổn thương trên da. Danh mục hiện có bao gồm gel trị sẹo, serum giảm thâm nám và một số sản phẩm hỗ trợ làm mờ dấu vết hoặc cải thiện cảm giác bề mặt da không đều màu.

Trang thương hiệu Scarguard phù hợp với khách hàng đang tìm một brand tập trung rõ vào hậu chăm sóc tổn thương và cải thiện thẩm mỹ bề mặt da. Việc xem toàn bộ sản phẩm Scarguard trong cùng một trang sẽ giúp bạn so sánh nhanh đâu là dòng phù hợp cho sẹo, đâu là dòng phù hợp cho thâm hoặc tình trạng da không đều màu.`,
  'seasonly': `Seasonly là thương hiệu có danh mục khá cân bằng trên Thế Giới Trị Mụn giữa dưỡng ẩm, phục hồi và chăm sóc da mụn. Website hiện có các dòng gel chấm mụn, kem dưỡng ẩm, dầu dưỡng đêm và một số sản phẩm booster, tạo nên một nhóm brand rất dễ ghép thành routine hoàn chỉnh.

Trang thương hiệu Seasonly được xây để khách hàng nhìn nhanh toàn cảnh: sản phẩm nào dành cho da thiếu ẩm, sản phẩm nào thiên về xử lý nốt mụn hoặc phục hồi sau treatment. Đây là brand phù hợp với người muốn một routine hiện đại, dễ dùng và có thể chuyển đổi linh hoạt theo tình trạng da từng giai đoạn.`,
  'tranzalpinehoney-new-zealand': `Tranzalpinehoney New Zealand tại Thế Giới Trị Mụn hiện được đại diện chủ yếu bởi nhóm sản phẩm từ mật ong Manuka và chăm sóc cổ họng. Dù danh mục chưa nhiều, đây vẫn là một thương hiệu có bản sắc rất rõ, phù hợp với khách hàng ưu tiên các sản phẩm ong mật chất lượng cao và hướng sử dụng hằng ngày.

Trang thương hiệu này giúp bạn xem nhanh toàn bộ SKU đang có của Tranzalpinehoney New Zealand mà không cần lọc qua nhiều danh mục khác nhau. Với những khách hàng đã quen mua sản phẩm mật ong hoặc kẹo ngậm hỗ trợ họng, đây là cách tiếp cận gọn và hiệu quả hơn.`,
  'xtendlife': `Xtendlife là thương hiệu có mặt tại Thế Giới Trị Mụn với các dòng chăm sóc da thiên về dưỡng chuyên sâu, nuôi dưỡng và hỗ trợ chống lão hóa. Danh mục hiện có trên website nổi bật với các sản phẩm Kanapa như dầu dưỡng, kem ngày đêm và những công thức hướng tới trải nghiệm da ẩm mềm, bề mặt da mượt và routine chăm sóc nhất quán.

Trang thương hiệu Xtendlife phù hợp với khách hàng muốn xem toàn bộ hệ sản phẩm của brand trong một cấu trúc rõ ràng trước khi quyết định mua. Với một thương hiệu có nhiều lựa chọn cho day cream, night cream và facial oil, landing page riêng giúp bạn chọn được nhịp routine phù hợp mà không bị rối.`,
};

async function getServiceRoleKey() {
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys`, {
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Cannot read api-keys: ${response.status} ${await response.text()}`);
  }

  const keys = await response.json();
  const serviceRole = keys.find((entry) => entry.name === 'service_role' && typeof entry.api_key === 'string')?.api_key;
  if (!serviceRole) {
    throw new Error('service_role key not found');
  }
  return serviceRole;
}

async function main() {
  const serviceRole = await getServiceRoleKey();
  const restBase = `https://${PROJECT_REF}.supabase.co/rest/v1`;

  const brandsResponse = await fetch(`${restBase}/product_brands?select=id,name,slug,description&order=name.asc`, {
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
    },
  });

  if (!brandsResponse.ok) {
    throw new Error(`Cannot fetch product_brands: ${brandsResponse.status} ${await brandsResponse.text()}`);
  }

  const brands = await brandsResponse.json();
  const missing = brands.filter((brand) => !BRAND_DESCRIPTIONS[brand.slug]).map((brand) => `${brand.slug} (${brand.name})`);
  if (missing.length > 0) {
    throw new Error(`Missing descriptions for slugs: ${missing.join(', ')}`);
  }

  for (const brand of brands) {
    const description = BRAND_DESCRIPTIONS[brand.slug];
    const updateResponse = await fetch(`${restBase}/product_brands?slug=eq.${encodeURIComponent(brand.slug)}`, {
      method: 'PATCH',
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ description }),
    });

    if (!updateResponse.ok) {
      throw new Error(`Cannot update ${brand.slug}: ${updateResponse.status} ${await updateResponse.text()}`);
    }

    console.log(`updated: ${brand.slug}`);
  }

  console.log(`done: ${brands.length} brands updated`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
